# Isolated official-CLI test harness only; never drives a user's terminal.
import os, pty, sys, json, base64, select, subprocess, fcntl, termios, struct
master, slave = pty.openpty()
fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack('HHHH', 32, 140, 0, 0))
child = subprocess.Popen(sys.argv[1:], stdin=slave, stdout=slave, stderr=slave, start_new_session=True)
os.close(slave)
try:
 while child.poll() is None:
  ready, _, _ = select.select([master, sys.stdin], [], [], 0.1)
  if master in ready:
   try: data=os.read(master, 65536)
   except OSError: break
   if not data: break
   # Answer terminal queries; these are capabilities, not human keystrokes.
   if b'\x1b[6n' in data: os.write(master,b'\x1b[1;1R')
   if b'\x1b[?u' in data: os.write(master,b'\x1b[?0u')
   print(json.dumps({'output':base64.b64encode(data).decode()}),flush=True)
  if sys.stdin in ready:
   line=sys.stdin.readline()
   if not line: break
   message=json.loads(line)
   if message.get('stop'): break
   os.write(master,base64.b64decode(message['input']))
finally:
 child.terminate()
 try: child.wait(timeout=3)
 except subprocess.TimeoutExpired: child.kill();child.wait()
 os.close(master)
