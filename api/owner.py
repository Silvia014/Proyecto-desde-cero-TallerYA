import getpass

from api.main import Signup, db, now, passwords, privacy_version

request = Signup(email=input("Email: "), name=input("Nombre: "), phone=input("Teléfono: "),
                 password=getpass.getpass("Contraseña: "), privacy=True)
with db() as connection:
    connection.execute(
        "INSERT INTO users(name,email,phone,password,locale,notices,privacy,accepted,role) VALUES(?,?,?,?,?,?,?,?,?)",
        (request.name, request.email.lower(), request.phone, passwords.hash(request.password),
         request.locale, False, privacy_version, now(), "owner"),
    )
