// Files of a Linux desktop session, written under the T3 home when one starts (see LinuxDesktop.ts).
// They run with the host's python3 and GNOME Shell, so they stay plain text here rather than
// bundled assets: the server ships as one executable.

const SESSION_SCRIPT = String.raw`#!/usr/bin/env python3
# T3 Code Linux desktop session: a headless GNOME Shell with its own D-Bus, PipeWire and settings,
# served on loopback in serve-sim's formats (AVCC and MJPEG streams, tagged-JSON input socket) and
# driven through Mutter's ScreenCast and RemoteDesktop APIs. Also takes the input and screenshot
# commands of the ydotool and grim shims agent-device runs.
import argparse, asyncio, base64, ctypes, hashlib, json, os, secrets, shutil, signal, struct, subprocess
import sys, threading, time, urllib.parse

import gi

gi.require_version("Gst", "1.0")
from gi.repository import Gio, GLib, Gst  # noqa: E402

RD = "org.gnome.Mutter.RemoteDesktop"
SC = "org.gnome.Mutter.ScreenCast"
BTN = {"left": 0x110, "right": 0x111, "middle": 0x112}
# USB HID usage -> evdev keycode, for the viewer's keyboard (serve-sim sends HID usages).
HID = {0x28: 28, 0x29: 1, 0x2A: 14, 0x2B: 15, 0x2C: 57, 0x2D: 12, 0x2E: 13, 0x2F: 26, 0x30: 27,
       0x31: 43, 0x33: 39, 0x34: 40, 0x35: 41, 0x36: 51, 0x37: 52, 0x38: 53, 0x39: 58, 0x44: 87,
       0x45: 88, 0x49: 110, 0x4A: 102, 0x4B: 104, 0x4C: 111, 0x4D: 107, 0x4E: 109, 0x4F: 106,
       0x50: 105, 0x51: 108, 0x52: 103, 0x54: 98, 0x55: 55, 0x56: 74, 0x57: 78, 0x58: 96, 0x59: 79,
       0x5A: 80, 0x5B: 81, 0x5C: 75, 0x5D: 76, 0x5E: 77, 0x5F: 71, 0x60: 72, 0x61: 73, 0x62: 82,
       0x63: 83, 0x67: 117, 0xE0: 29, 0xE1: 42, 0xE2: 56, 0xE3: 125, 0xE4: 97, 0xE5: 54, 0xE6: 100,
       0xE7: 126}
HID.update({0x04 + i: k for i, k in enumerate(
    [30, 48, 46, 32, 18, 33, 34, 35, 23, 36, 37, 38, 50, 49, 24, 25, 16, 19, 31, 20, 22, 47, 17, 45, 21, 44])})
HID.update({0x1E + i: 2 + i for i in range(10)})  # 1..9, 0
HID.update({0x3A + i: 59 + i for i in range(10)})  # F1..F10


def keysym(ch):
    cp = ord(ch)
    if ch == "\n":
        return 0xFF0D
    if ch == "\t":
        return 0xFF09
    return cp if 0x20 <= cp <= 0x7E or 0xA0 <= cp <= 0xFF else 0x01000000 | cp


def parse_ydotool(args):
    """ydotool's argv (the subset agent-device uses) as input actions."""
    if not args:
        raise ValueError("no ydotool command")
    cmd, rest = args[0], args[1:]
    if cmd == "mousemove":
        opts = {}
        it = iter(rest)
        for a in it:
            if a in ("-x", "-y"):
                opts[a[1]] = float(next(it))
            elif a in ("--absolute", "-a"):
                opts["absolute"] = True
            elif a in ("--wheel", "-w"):
                opts["wheel"] = True
        if opts.get("wheel"):
            return [("scroll", int(opts.get("x", 0)), int(opts.get("y", 0)))]
        if opts.get("absolute"):
            return [("motion", opts.get("x", 0.0), opts.get("y", 0.0))]
        return [("relative", opts.get("x", 0.0), opts.get("y", 0.0))]
    if cmd == "click":
        down = "--down" in rest or "-D" in rest
        up = "--up" in rest or "-U" in rest
        out = []
        for code in (a for a in rest if not a.startswith("-")):
            value = int(code, 0)
            button = ["left", "right", "middle"][value & 0x0F] if value & 0x0F < 3 else "left"
            if value & 0x40 and not up:
                out.append(("button", button, True))
            if value & 0x80 and not down:
                out.append(("button", button, False))
        return out
    if cmd == "key":
        return [("key", int(k), s == "1") for k, s in (a.split(":") for a in rest if ":" in a)]
    if cmd == "type":
        text = " ".join(rest[rest.index("--") + 1:] if "--" in rest else [a for a in rest if not a.startswith("-")])
        return [("text", text)]
    raise ValueError(f"unsupported ydotool command: {cmd}")


def die_with_parent():
    try:
        ctypes.CDLL("libc.so.6").prctl(1, signal.SIGTERM)  # PR_SET_PDEATHSIG
    except OSError:
        pass


class Session:
    def __init__(self, args):
        self.args = args
        self.rt = args.runtime_dir
        self.children = []
        self.width, self.height = (int(v) for v in args.size.split("x"))
        self.env = dict(os.environ)
        data = args.data_dir
        self.env.update({
            "XDG_RUNTIME_DIR": self.rt,
            "DBUS_SESSION_BUS_ADDRESS": f"unix:path={self.rt}/bus",
            "DBUS_SYSTEM_BUS_ADDRESS": f"unix:path={self.rt}/system_bus",
            "WAYLAND_DISPLAY": "wayland-0",
            "XDG_SESSION_TYPE": "wayland",
            "XDG_CURRENT_DESKTOP": "GNOME",
            "XDG_SESSION_DESKTOP": "gnome",
            "DESKTOP_SESSION": "gnome",
            "GDK_BACKEND": "wayland",
            # Settings, extensions and app data stay with this session, not the user's own desktop.
            "XDG_CONFIG_HOME": f"{data}/config",
            "XDG_DATA_HOME": f"{data}/data",
            "XDG_CACHE_HOME": f"{data}/cache",
            "XDG_STATE_HOME": f"{data}/state",
            "NO_AT_BRIDGE": "0",
            "GTK_A11Y": "atspi",
        })
        for key in ("DISPLAY", "WAYLAND_SOCKET", "SESSION_MANAGER"):
            self.env.pop(key, None)
        # This process's own PipeWire client (pipewiresrc) must find the session's daemon too.
        os.environ.clear()
        os.environ.update(self.env)
        self.pressed_keys, self.pressed_buttons = set(), set()
        self.input_lock = threading.Lock()

    # -- processes -------------------------------------------------------------------------------
    def spawn(self, argv, log):
        out = open(os.path.join(self.rt, log), "ab")
        child = subprocess.Popen(argv, env=self.env, stdin=subprocess.DEVNULL, stdout=out,
                                 stderr=subprocess.STDOUT, preexec_fn=die_with_parent)
        self.children.append(child)
        return child

    def start(self):
        os.makedirs(self.rt, mode=0o700, exist_ok=True)
        os.chmod(self.rt, 0o700)
        for name in os.listdir(self.rt):
            if name in ("bus", "system_bus", "wayland-0", "wayland-0.lock") or name.startswith("pipewire-0"):
                try:
                    os.unlink(os.path.join(self.rt, name))
                except OSError:
                    pass
        for sub in ("config", "data", "cache", "state"):
            os.makedirs(os.path.join(self.args.data_dir, sub), exist_ok=True)
        # GNOME Shell 50 aborts without a system bus; an empty private one is enough.
        self.spawn(["dbus-daemon", "--session", "--nofork", "--nopidfile",
                    f"--address=unix:path={self.rt}/system_bus"], "system-bus.log")
        self.spawn(["dbus-daemon", "--session", "--nofork", "--nopidfile",
                    f"--address=unix:path={self.rt}/bus"], "session-bus.log")
        for name in ("bus", "system_bus"):
            self.wait_for(lambda: os.path.exists(os.path.join(self.rt, name)), 10, f"the {name} D-Bus")
        for schema, key, value in (("org.gnome.desktop.session", "idle-delay", "uint32 0"),
                                   ("org.gnome.desktop.screensaver", "lock-enabled", "false"),
                                   ("org.gnome.desktop.notifications", "show-banners", "true"),
                                   ("org.gnome.desktop.interface", "toolkit-accessibility", "true")):
            self.gsettings("set", schema, key, value)
        self.install_extension()
        self.spawn(["pipewire"], "pipewire.log")
        self.wait_for(lambda: os.path.exists(os.path.join(self.rt, "pipewire-0")), 10, "PipeWire")
        self.spawn(["wireplumber"], "wireplumber.log")
        self.shell = self.spawn(["gnome-shell", "--headless", "--wayland", "--virtual-monitor",
                                 f"{self.width}x{self.height}"], "gnome-shell.log")
        self.bus = Gio.DBusConnection.new_for_address_sync(
            self.env["DBUS_SESSION_BUS_ADDRESS"],
            Gio.DBusConnectionFlags.AUTHENTICATION_CLIENT | Gio.DBusConnectionFlags.MESSAGE_BUS_CONNECTION,
            None, None)
        self.wait_for(self.shell_ready, 60, "GNOME Shell")
        self.input_session()

    def gsettings(self, *args):
        return subprocess.run(["gsettings", *args], env=self.env, capture_output=True, text=True,
                              timeout=15).stdout.strip()

    def install_extension(self):
        uuid = "t3-desktop@t3.codes"
        target = os.path.join(self.args.data_dir, "data", "gnome-shell", "extensions", uuid)
        shutil.rmtree(target, ignore_errors=True)
        shutil.copytree(self.args.extension_dir, target)
        try:
            enabled = list(GLib.Variant.parse(None, self.gsettings("get", "org.gnome.shell", "enabled-extensions") or "@as []").unpack())
        except GLib.Error:
            enabled = []
        if uuid not in enabled:
            self.gsettings("set", "org.gnome.shell", "enabled-extensions", str(enabled + [uuid]))

    def wait_for(self, check, seconds, what):
        deadline = time.monotonic() + seconds
        while time.monotonic() < deadline:
            if self.shell_exited() if what == "GNOME Shell" else False:
                raise RuntimeError(f"GNOME Shell exited during startup: {self.log_tail('gnome-shell.log')}")
            if check():
                return
            time.sleep(0.1)
        raise RuntimeError(f"{what} did not start within {seconds}s")

    def shell_exited(self):
        return getattr(self, "shell", None) is not None and self.shell.poll() is not None

    def log_tail(self, name):
        try:
            with open(os.path.join(self.rt, name), "rb") as f:
                return f.read()[-1500:].decode(errors="replace")
        except OSError:
            return ""

    def shell_ready(self):
        try:
            owner = self.call("org.freedesktop.DBus", "/org/freedesktop/DBus", "org.freedesktop.DBus",
                              "NameHasOwner", GLib.Variant("(s)", (RD,)))
            return owner[0]
        except GLib.Error:
            return False

    def stop(self):
        for child in reversed(self.children):
            if child.poll() is None:
                child.terminate()
        for child in reversed(self.children):
            try:
                child.wait(5)
            except subprocess.TimeoutExpired:
                child.kill()

    # -- D-Bus -----------------------------------------------------------------------------------
    def call(self, name, path, iface, method, args=None):
        result = self.bus.call_sync(name, path, iface, method, args, None, Gio.DBusCallFlags.NONE, 10000, None)
        return result.unpack() if result is not None else ()

    def record(self, rd_session_id=None, cursor=1):
        """A new ScreenCast session of the virtual monitor; returns (session path, stream path, node)."""
        props = {"remote-desktop-session-id": GLib.Variant("s", rd_session_id)} if rd_session_id else {}
        session = self.call(SC, "/org/gnome/Mutter/ScreenCast", SC, "CreateSession",
                            GLib.Variant("(a{sv})", (props,)))[0]
        stream = self.call(SC, session, SC + ".Session", "RecordMonitor",
                           GLib.Variant("(sa{sv})", ("", {"cursor-mode": GLib.Variant("u", cursor)})))[0]
        added = threading.Event()
        node = []

        def on_added(_c, _s, _p, _i, _n, params):
            node.append(params.unpack()[0])
            added.set()

        sub = self.bus.signal_subscribe(SC, SC + ".Stream", "PipeWireStreamAdded", stream, None,
                                        Gio.DBusSignalFlags.NONE, on_added)
        try:
            if rd_session_id:
                self.call(RD, self.rd, RD + ".Session", "Start")
            else:
                self.call(SC, session, SC + ".Session", "Start")
            if not added.wait(10):
                raise RuntimeError("Mutter did not publish the screen cast stream")
        finally:
            self.bus.signal_unsubscribe(sub)
        return session, stream, node[0]

    def stop_cast(self, session):
        try:
            self.call(SC, session, SC + ".Session", "Stop")
        except GLib.Error:
            pass

    def input_session(self):
        self.rd = self.call(RD, "/org/gnome/Mutter/RemoteDesktop", RD, "CreateSession")[0]
        rd_id = self.call(RD, self.rd, "org.freedesktop.DBus.Properties", "Get",
                          GLib.Variant("(ss)", (RD + ".Session", "SessionId")))[0]
        _, self.input_stream, _ = self.record(rd_id)
        # Mutter creates the virtual pointer and keyboard on their first event and drops that event,
        # so spend it on a no-op (and park the pointer mid-screen) before anyone sends real input.
        self.act([("motion", self.width / 2, self.height / 2), ("key", 42, True), ("key", 42, False)])
        time.sleep(0.3)

    def rd_call(self, method, signature, *values):
        self.call(RD, self.rd, RD + ".Session", method, GLib.Variant(signature, values))

    def act(self, actions):
        with self.input_lock:
            for action in actions:
                kind = action[0]
                if kind == "motion":
                    x = min(max(action[1], 0), self.width - 1)
                    y = min(max(action[2], 0), self.height - 1)
                    self.rd_call("NotifyPointerMotionAbsolute", "(sdd)", self.input_stream, x, y)
                elif kind == "relative":
                    self.rd_call("NotifyPointerMotion", "(dd)", action[1], action[2])
                elif kind == "button":
                    code = BTN[action[1]]
                    if action[2]:
                        self.pressed_buttons.add(code)
                    else:
                        self.pressed_buttons.discard(code)
                    self.rd_call("NotifyPointerButton", "(ib)", code, action[2])
                elif kind == "scroll":
                    for axis, steps in ((1, action[1]), (0, action[2])):
                        if steps:
                            self.rd_call("NotifyPointerAxisDiscrete", "(ui)", axis, steps)
                elif kind == "key":
                    if action[2]:
                        self.pressed_keys.add(action[1])
                    else:
                        self.pressed_keys.discard(action[1])
                    self.rd_call("NotifyKeyboardKeycode", "(ub)", action[1], action[2])
                elif kind == "text":
                    for ch in action[1]:
                        sym = keysym(ch)
                        self.rd_call("NotifyKeyboardKeysym", "(ub)", sym, True)
                        self.rd_call("NotifyKeyboardKeysym", "(ub)", sym, False)
                time.sleep(0.004)

    def release_all(self):
        self.act([("key", k, False) for k in list(self.pressed_keys)] +
                 [("button", b, False) for b in ("left", "right", "middle") if BTN[b] in self.pressed_buttons])


# -- encoding ------------------------------------------------------------------------------------
def h264_encoder():
    for name, props in (("vah264enc", "b-frames=0 key-int-max=600 rate-control=vbr bitrate=8000"),
                        ("vah264lpenc", "b-frames=0 key-int-max=600 rate-control=vbr bitrate=8000"),
                        ("x264enc", "tune=zerolatency speed-preset=ultrafast bitrate=6000 key-int-max=600"),
                        ("openh264enc", "bitrate=6000000 gop-size=600")):
        if Gst.ElementFactory.find(name):
            pre = "vapostproc ! video/x-raw(memory:VAMemory),format=NV12" if name.startswith("va") \
                else "videoconvert ! video/x-raw,format=I420"
            return name, f"{pre} ! {name} {props}"
    return None, None


class Feed:
    """One GStreamer pipeline on its own screen cast, delivering samples to an asyncio queue."""

    def __init__(self, session, loop, tail, cursor=1, keepalive=True):
        self.session, self.loop = session, loop
        self.queue = asyncio.Queue(maxsize=8)
        self.cast, _, node = session.record(cursor=cursor)
        keep = " keepalive-time=1000" if keepalive else ""
        self.pipeline = Gst.parse_launch(
            f"pipewiresrc path={node} do-timestamp=true{keep} ! {tail} ! "
            "appsink name=out emit-signals=true max-buffers=4 drop=false sync=false")
        sink = self.pipeline.get_by_name("out")
        sink.connect("new-sample", self.on_sample)
        bus = self.pipeline.get_bus()
        bus.add_signal_watch()
        bus.connect("message::error", self.on_error)
        bus.connect("message::eos", lambda *_: self.push(None))
        self.pipeline.set_state(Gst.State.PLAYING)

    def push(self, item):
        def put():
            if self.queue.full():
                if item is None:
                    self.queue.get_nowait()
                else:
                    return  # the client is behind; drop rather than buffer without bound
            self.queue.put_nowait(item)
        self.loop.call_soon_threadsafe(put)

    def on_sample(self, sink):
        sample = sink.emit("pull-sample")
        buf = sample.get_buffer()
        ok, info = buf.map(Gst.MapFlags.READ)
        if ok:
            data = bytes(info.data)
            buf.unmap(info)
            key = not buf.has_flags(Gst.BufferFlags.DELTA_UNIT)
            self.push((sample.get_caps(), data, key))
        return Gst.FlowReturn.OK

    def on_error(self, _bus, message):
        err, debug = message.parse_error()
        print(f"pipeline error: {err.message} {debug}", file=sys.stderr, flush=True)
        self.push(None)

    def close(self):
        self.pipeline.set_state(Gst.State.NULL)
        self.session.stop_cast(self.cast)


# -- HTTP / WebSocket ----------------------------------------------------------------------------
class Server:
    def __init__(self, session, token):
        self.session, self.token = session, token
        self.encoder, self.h264 = h264_encoder()

    async def handle(self, reader, writer):
        try:
            head = await reader.readuntil(b"\r\n\r\n")
        except (asyncio.IncompleteReadError, asyncio.LimitOverrunError):
            writer.close()
            return
        lines = head.decode("latin-1").split("\r\n")
        method, target, _ = (lines[0].split(" ") + ["", ""])[:3]
        headers = {}
        for line in lines[1:]:
            if ":" in line:
                k, v = line.split(":", 1)
                headers[k.strip().lower()] = v.strip()
        url = urllib.parse.urlsplit(target)
        path, query = url.path, urllib.parse.parse_qs(url.query)
        try:
            if path == "/health":
                return await self.reply(writer, 200, b"ok", "text/plain")
            if not secrets.compare_digest(headers.get("x-t3-desktop-token", ""), self.token):
                return await self.reply(writer, 401, b"unauthorized", "text/plain")
            body = b""
            if "content-length" in headers:
                body = await reader.readexactly(int(headers["content-length"]))
            if path == "/api":
                return await self.reply(writer, 200, json.dumps({"encoder": self.encoder}).encode())
            if path == "/helper/ws" and headers.get("upgrade", "").lower() == "websocket":
                return await self.websocket(reader, writer, headers)
            if path.endswith("/stream.avcc"):
                return await self.avcc(writer)
            if path.endswith("/stream.mjpeg"):
                return await self.mjpeg(writer)
            if path in ("/api/screenshot", "/screenshot.png") and method in ("GET", "POST"):
                return await self.reply(writer, 200, await self.screenshot(), "image/png")
            if path == "/input" and method == "POST":
                actions = parse_ydotool(json.loads(body or b"[]"))
                await asyncio.to_thread(self.session.act, actions)
                return await self.reply(writer, 200, b"{}")
            return await self.reply(writer, 404, b"not found", "text/plain")
        except (ValueError, KeyError) as error:
            return await self.reply(writer, 400, str(error).encode(), "text/plain")
        except (ConnectionError, asyncio.CancelledError):
            pass
        except Exception as error:  # noqa: BLE001 - report, keep serving
            print(f"request {path} failed: {error!r}", file=sys.stderr, flush=True)
            try:
                await self.reply(writer, 500, str(error).encode(), "text/plain")
            except ConnectionError:
                pass
        finally:
            try:
                writer.close()
            except Exception:  # noqa: BLE001
                pass

    async def reply(self, writer, status, body, ctype="application/json"):
        writer.write(f"HTTP/1.1 {status} X\r\nContent-Type: {ctype}\r\nContent-Length: {len(body)}\r\n"
                     "Cache-Control: no-store\r\nConnection: close\r\n\r\n".encode() + body)
        await writer.drain()

    async def open_stream(self, writer, ctype):
        writer.write(f"HTTP/1.1 200 OK\r\nContent-Type: {ctype}\r\nCache-Control: no-store\r\n"
                     "Connection: close\r\n\r\n".encode())
        await writer.drain()

    async def feed(self, tail, cursor=1, keepalive=True):
        loop = asyncio.get_running_loop()
        return await asyncio.to_thread(Feed, self.session, loop, tail, cursor, keepalive)

    async def pump(self, writer, feed, encode):
        try:
            while True:
                item = await feed.queue.get()
                if item is None:
                    return
                writer.write(encode(*item))
                await writer.drain()
        finally:
            await asyncio.to_thread(feed.close)

    async def avcc(self, writer):
        if not self.h264:
            # No H.264 encoder here; the viewer falls back to MJPEG.
            return await self.reply(writer, 501, b"no H.264 encoder", "text/plain")
        feed = await self.feed(f"{self.h264} ! h264parse ! video/x-h264,stream-format=avc,alignment=au")
        await self.open_stream(writer, "application/octet-stream")
        last = [None]

        def envelope(tag, payload):
            return struct.pack(">IB", len(payload) + 1, tag) + payload

        def encode(caps, data, key):
            out = b""
            codec = caps.get_structure(0).get_value("codec_data")
            if codec is not None:
                ok, info = codec.map(Gst.MapFlags.READ)
                desc = bytes(info.data)
                codec.unmap(info)
                if desc != last[0]:
                    last[0] = desc
                    out += envelope(1, desc)
            return out + envelope(2 if key else 3, data)

        await self.pump(writer, feed, encode)

    async def mjpeg(self, writer):
        feed = await self.feed("videoconvert ! jpegenc quality=80")
        await self.open_stream(writer, "multipart/x-mixed-replace; boundary=frame")
        await self.pump(writer, feed, lambda _caps, data, _key: (
            b"--frame\r\nContent-Type: image/jpeg\r\nContent-Length: %d\r\n\r\n" % len(data) + data + b"\r\n"))

    async def screenshot(self):
        feed = await self.feed("videoconvert ! pngenc snapshot=true", cursor=0, keepalive=False)
        try:
            item = await asyncio.wait_for(feed.queue.get(), 10)
        finally:
            await asyncio.to_thread(feed.close)
        if item is None:
            raise RuntimeError("the screen capture ended without a frame")
        return item[1]

    async def websocket(self, reader, writer, headers):
        accept = base64.b64encode(hashlib.sha1(
            (headers["sec-websocket-key"] + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").encode()).digest())
        writer.write(b"HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n"
                     b"Sec-WebSocket-Accept: " + accept + b"\r\n\r\n")

        def frame(payload, opcode=2):
            n = len(payload)
            head = bytes([0x80 | opcode]) + (bytes([n]) if n < 126 else
                                             bytes([126]) + struct.pack(">H", n) if n < 65536 else
                                             bytes([127]) + struct.pack(">Q", n))
            return head + payload

        session = self.session
        config = {"width": session.width, "height": session.height, "orientation": "landscape_left"}
        writer.write(frame(bytes([0x83])) + frame(bytes([0x82]) + json.dumps(config).encode()))
        await writer.drain()
        point = lambda m: (m["x"] * session.width, m["y"] * session.height)  # noqa: E731
        try:
            while True:
                b0, b1 = await reader.readexactly(2)
                opcode, n = b0 & 0x0F, b1 & 0x7F
                if n == 126:
                    n = struct.unpack(">H", await reader.readexactly(2))[0]
                elif n == 127:
                    n = struct.unpack(">Q", await reader.readexactly(8))[0]
                mask = await reader.readexactly(4) if b1 & 0x80 else b"\0\0\0\0"
                data = bytes(c ^ mask[i % 4] for i, c in enumerate(await reader.readexactly(n)))
                if opcode == 8:
                    return
                if opcode == 9:
                    writer.write(frame(data, 10))
                    continue
                if opcode != 2 or not data:
                    continue
                msg = json.loads(data[1:])
                tag, actions = data[0], []
                if tag == 0x03:  # touch: the primary button follows the pointer
                    actions.append(("motion", *point(msg)))
                    if msg["type"] == "begin":
                        actions.append(("button", "left", True))
                    elif msg["type"] == "end":
                        actions.append(("button", "left", False))
                elif tag == 0x06 and msg.get("usage") in HID:
                    actions.append(("key", HID[msg["usage"]], msg["type"] == "down"))
                elif tag == 0x20:  # desktop pointer: hover, other buttons, wheel
                    if "x" in msg:
                        actions.append(("motion", *point(msg)))
                    if msg["type"] == "button":
                        actions.append(("button", msg["button"], msg["down"]))
                    elif msg["type"] == "scroll":
                        actions.append(("scroll", int(msg.get("dx", 0)), int(msg.get("dy", 0))))
                    elif msg["type"] == "text":
                        actions.append(("text", str(msg["text"])[:4096]))
                if actions:
                    await asyncio.to_thread(session.act, actions)
        except (asyncio.IncompleteReadError, ConnectionError, json.JSONDecodeError, KeyError):
            return
        finally:
            await asyncio.to_thread(session.release_all)


async def serve(session, args, token):
    server = Server(session, token)
    listener = await asyncio.start_server(server.handle, "127.0.0.1", args.port)
    port = listener.sockets[0].getsockname()[1]
    with open(os.path.join(args.runtime_dir, "port"), "w") as f:
        f.write(str(port))
    print(json.dumps({"ready": True, "port": port, "encoder": server.encoder}), flush=True)
    stop = asyncio.Event()
    loop = asyncio.get_running_loop()
    # Not loop.add_signal_handler: PyGObject's GLib loop thread leaves asyncio's signal wakeup
    # unreliable, and a plain handler still runs when the signal interrupts the main thread.
    for sig in (signal.SIGTERM, signal.SIGINT):
        signal.signal(sig, lambda *_: loop.call_soon_threadsafe(stop.set))

    async def watch_shell():
        while session.shell.poll() is None:
            await asyncio.sleep(1)
        print(f"GNOME Shell exited: {session.log_tail('gnome-shell.log')}", file=sys.stderr, flush=True)
        stop.set()

    watcher = asyncio.create_task(watch_shell())
    async with listener:
        await stop.wait()
    watcher.cancel()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--runtime-dir", required=True)
    parser.add_argument("--data-dir", required=True)
    parser.add_argument("--extension-dir", required=True)
    parser.add_argument("--size", default="1440x900")
    parser.add_argument("--port", type=int, default=0)
    args = parser.parse_args()
    die_with_parent()
    Gst.init(None)
    threading.Thread(target=GLib.MainLoop().run, daemon=True).start()
    session = Session(args)
    token_file = os.path.join(args.runtime_dir, "token")
    try:
        session.start()
        token = secrets.token_hex(16)
        fd = os.open(token_file, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        os.write(fd, token.encode())
        os.close(fd)
        asyncio.run(serve(session, args, token))
    except Exception as error:  # noqa: BLE001 - one line the server can show
        print(json.dumps({"ready": False, "error": str(error)}), flush=True)
        sys.exit(1)
    finally:
        session.stop()


if __name__ == "__main__":
    main()
`;

const YDOTOOL_SHIM = String.raw`#!/usr/bin/env python3
# ydotool for agent-device in a T3 Code desktop session: input goes through the session's Mutter.
import json, os, sys, urllib.request
rt = os.environ["T3_DESKTOP_RUNTIME_DIR"]
port = open(os.path.join(rt, "port")).read().strip()
token = open(os.path.join(rt, "token")).read().strip()
request = urllib.request.Request(f"http://127.0.0.1:{port}/input", data=json.dumps(sys.argv[1:]).encode(),
                                 headers={"x-t3-desktop-token": token, "content-type": "application/json"})
try:
    urllib.request.urlopen(request, timeout=20).read()
except Exception as error:
    sys.exit(f"ydotool: {getattr(error, 'read', lambda: str(error).encode())().decode(errors='replace')}")
`;

const GRIM_SHIM = String.raw`#!/usr/bin/env python3
# grim for agent-device in a T3 Code desktop session: the screen comes from the session's Mutter.
import os, sys, urllib.request
rt = os.environ["T3_DESKTOP_RUNTIME_DIR"]
port = open(os.path.join(rt, "port")).read().strip()
token = open(os.path.join(rt, "token")).read().strip()
target = next((a for a in reversed(sys.argv[1:]) if not a.startswith("-") or a == "-"), "-")
request = urllib.request.Request(f"http://127.0.0.1:{port}/api/screenshot", method="POST",
                                 headers={"x-t3-desktop-token": token})
try:
    data = urllib.request.urlopen(request, timeout=20).read()
except Exception as error:
    sys.exit(f"grim: {error}")
if target == "-":
    sys.stdout.buffer.write(data)
else:
    with open(target, "wb") as f:
        f.write(data)
`;

const ATSPI_WINDOW_ORIGINS = String.raw`# Loaded by Python runs of agent-device in a T3 Code desktop session. On Wayland, GTK reports
# each window's screen position as 0,0; agent-device's AT-SPI dump adds that origin to every
# widget, so shift it by the window's real frame position, which the session's Shell publishes.
import sys

if sys.argv and sys.argv[0].endswith("atspi-dump.py"):
    try:
        import json

        import gi

        gi.require_version("Atspi", "2.0")
        from gi.repository import Atspi, Gio, GLib

        _windows = json.loads(Gio.bus_get_sync(Gio.BusType.SESSION).call_sync(
            "org.t3.Desktop", "/org/t3/Desktop", "org.t3.Desktop", "Windows", None,
            GLib.VariantType("(s)"), Gio.DBusCallFlags.NONE, 2000, None).unpack()[0])
        _get_extents = Atspi.Component.get_extents

        def _screen_extents(self, coord_type):
            extents = _get_extents(self, coord_type)
            if coord_type != Atspi.CoordType.SCREEN or extents is None or (extents.x, extents.y) != (0, 0):
                return extents
            try:
                pid, title = self.get_process_id(), self.get_name()
            except GLib.Error:
                return extents
            matches = [w for w in _windows if w["pid"] == pid and w["title"] == title]
            sized = [w for w in matches if (w["width"], w["height"]) == (extents.width, extents.height)]
            if sized or matches:
                window = (sized or matches)[0]
                extents.x, extents.y = window["x"], window["y"]
            return extents

        Atspi.Component.get_extents = _screen_extents
    except Exception:  # noqa: BLE001 - without the Shell's answer, keep agent-device's own rects
        pass
`;

const EXTENSION_METADATA = String.raw`{
  "uuid": "t3-desktop@t3.codes",
  "name": "T3 Code desktop session",
  "description": "Publishes window positions for agent tools in a T3 Code desktop session.",
  "shell-version": ["45", "46", "47", "48", "49", "50", "51", "52"]
}
`;

const EXTENSION_SCRIPT = String.raw`// Wayland clients do not know where their windows are, so their accessibility trees place every
// window at 0,0. Agent tools read the real frame positions here.
import Gio from 'gi://Gio';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const IFACE = '<node><interface name="org.t3.Desktop">' +
    '<method name="Windows"><arg type="s" direction="out"/></method>' +
    '</interface></node>';

export default class T3Desktop extends Extension {
    enable() {
        this._object = Gio.DBusExportedObject.wrapJSObject(IFACE, this);
        this._object.export(Gio.DBus.session, '/org/t3/Desktop');
        this._name = Gio.bus_own_name_on_connection(
            Gio.DBus.session, 'org.t3.Desktop', Gio.BusNameOwnerFlags.NONE, null, null);
        // The Shell opens the overview once it has started; a test desktop starts on the workspace.
        if (Main.layoutManager._startingUp) {
            this._startup = Main.layoutManager.connect('startup-complete', () => {
                Main.layoutManager.disconnect(this._startup);
                this._startup = 0;
                Main.overview.hide();
            });
        }
    }

    disable() {
        if (this._startup)
            Main.layoutManager.disconnect(this._startup);
        this._startup = 0;
        this._object?.unexport();
        this._object = null;
        if (this._name)
            Gio.bus_unown_name(this._name);
        this._name = 0;
    }

    Windows() {
        return JSON.stringify(global.get_window_actors().map(actor => {
            const window = actor.meta_window;
            const rect = window.get_frame_rect();
            return {pid: window.get_pid(), title: window.get_title() ?? '', x: rect.x, y: rect.y,
                width: rect.width, height: rect.height};
        }));
    }
}
`;

export const LINUX_DESKTOP_FILES: ReadonlyArray<{
  readonly path: string;
  readonly contents: string;
  readonly executable: boolean;
}> = [
  { path: "session.py", contents: SESSION_SCRIPT, executable: true },
  { path: "bin/ydotool", contents: YDOTOOL_SHIM, executable: true },
  { path: "bin/grim", contents: GRIM_SHIM, executable: true },
  { path: "python/sitecustomize.py", contents: ATSPI_WINDOW_ORIGINS, executable: false },
  { path: "extension/metadata.json", contents: EXTENSION_METADATA, executable: false },
  { path: "extension/extension.js", contents: EXTENSION_SCRIPT, executable: false },
];
