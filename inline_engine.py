with open('motor_engine.js', 'r') as f:
    engine_code = f.read()

with open('index.html', 'r') as f:
    html = f.read()

html = html.replace('<script src="motor_engine.js"></script>', '<script>\n' + engine_code + '\n</script>')

with open('index.html', 'w') as f:
    f.write(html)
print("Inlined motor_engine.js successfully")
