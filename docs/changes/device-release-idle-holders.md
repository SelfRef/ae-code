Opening a device in a thread now releases the claim of a finished thread that still held it, instead of failing with the other thread's session name; a thread that is still working keeps its device.
