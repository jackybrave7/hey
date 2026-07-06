import pathlib
root = pathlib.Path(__file__).resolve().parent.parent
for name in ('deploy.bat', 'rollback.bat'):
    p = root / name
    text = p.read_text(encoding='utf-8')
    text = text.replace('\r\n', '\n').replace('\n', '\r\n')
    p.write_bytes(text.encode('utf-8'))
    data = p.read_bytes()
    print(name, 'CR', data.count(b'\r'), 'LF', data.count(b'\n'))
