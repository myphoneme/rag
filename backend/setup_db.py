
import sys
import os

# 1. Current folder cha path Python la sangnyasathi
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
sys.path.append(parent_dir)

# 2. Ata imports barobar chalatil
try:
    from app.database import create_user, init_db
    print("✅ Database modules sapdle!")
except ImportError:
    # Jar varcha chalala nahi tar ha prayatna karel
    from backend.app.database import create_user, init_db
    print("✅ Backend modules sapdle!")

def setup():
    print("🔄 Database initialization suru hot aahe...")
    init_db()
    # Tumche default accounts banva
    create_user("Admin", "admin@phoneme.com", "admin123", "admin")
    create_user("Student", "student@phoneme.com", "user123", "user")
    print("✅ Database successfully initialize jhala ani Admin/User accounts banvle gela!")

if __name__ == "__main__":
    setup()