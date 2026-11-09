"""
hash_passwords.py — UniAdvisor AI
Run this to generate bcrypt hashes for your own passwords,
then update the Supabase users table.

Usage:
  python hash_passwords.py "a-strong-password" ["another-password" ...]

Requires:  pip install bcrypt
"""
import sys

try:
    import bcrypt
except ImportError:
    print("ERROR: bcrypt not installed. Run:  pip install bcrypt")
    sys.exit(1)

def hash_pw(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt(12)).decode()

def verify_pw(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())

if __name__ == "__main__":
    passwords = sys.argv[1:]
    if not passwords:
        print('Usage: python hash_passwords.py "a-strong-password" ["another-password" ...]')
        sys.exit(1)
    print("\n═══════════════════════════════════════")
    print("  UniAdvisor AI — Password Hasher")
    print("═══════════════════════════════════════\n")
    for pw in passwords:
        h = hash_pw(pw)
        print(f"  Hash     : {h}")
        print(f"  Verify   : {'✅ OK' if verify_pw(pw, h) else '❌ FAIL'}")
        print()
    print("Copy the hashes into your Supabase users table (password_hash column).")
    print("SQL example:")
    print("  UPDATE users SET password_hash = '<hash>' WHERE email = 'user@example.com';")
    print()