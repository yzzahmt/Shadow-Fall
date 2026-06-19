with open('index.html', 'r') as f:
    code = f.read()

code = code.replace('<script src="limbo_engine.js"></script>', '<script src="motor_engine.js"></script>')

with open('index.html', 'w') as f:
    f.write(code)
print("Fixed script src")
