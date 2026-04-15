import sqlite3
import os
from passlib.context import CryptContext

# Password security
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Base directory find
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Database path
DB_PATH = os.path.join(BASE_DIR, "db", "users.sqlite3")


def get_db_connection():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)  # db folder auto create
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db_connection()
    

    conn.execute('''
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        email TEXT UNIQUE NOT NULL,
        hashed_password TEXT NOT NULL,
        role TEXT NOT NULL
    )
''')

    conn.commit()
    conn.close()


def verify_user(email, password):
    conn = get_db_connection()

    user = conn.execute(
        "SELECT * FROM users WHERE email=?",
        (email,)
    ).fetchone()

    conn.close()

    if user and pwd_context.verify(password, user["hashed_password"]):
        return user   # ✔ user object return

    return None

def create_user(name, email, password, role):
    hashed = pwd_context.hash(password)

    conn = get_db_connection()

    try:
        conn.execute(
            "INSERT INTO users (name, email, hashed_password, role) VALUES (?, ?, ?, ?)",
            (name, email, hashed, role)
        )
        conn.commit()
        return True

    except sqlite3.IntegrityError:
        return False

    finally:
        conn.close()
def create_default_admin():
    conn = get_db_connection()

    admin = conn.execute(
        "SELECT * FROM users WHERE email=?",
        ("admin@phoneme.com",)
    ).fetchone()

    if not admin:
        hashed = pwd_context.hash("admin123")

        conn.execute(
            "INSERT INTO users (email, hashed_password, role) VALUES (?, ?, ?)",
            ("admin@phoneme.com", hashed, "admin")
        )

        conn.commit()

    conn.close()   
#def delete_user(email):
    #conn = get_db_connection()
    #try:
        #conn.execute("DELETE FROM users WHERE email=?", (email,))
        #conn.commit()
        #return True
    ##finally:
       # conn.close()   
def delete_user(email):
    conn = get_db_connection()
    cursor = conn.execute("DELETE FROM users WHERE email=?", (email,))
    conn.commit()

    if cursor.rowcount == 0:
        return False   # ❌ user not found

    return True  