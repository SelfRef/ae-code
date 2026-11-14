Agents check `device_list` before saying an Android emulator or other device is unavailable, instead of concluding from a missing `adb` on PATH or an empty `adb devices`.
