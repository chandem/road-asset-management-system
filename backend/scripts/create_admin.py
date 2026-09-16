import argparse
import getpass

from sqlalchemy import select

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.user import User


def main() -> None:
    parser = argparse.ArgumentParser(description="Create or update a RAMS admin user")
    parser.add_argument("--username", required=True)
    parser.add_argument("--full-name", required=True)
    parser.add_argument("--email")
    args = parser.parse_args()

    password = getpass.getpass("Admin password: ")
    confirmation = getpass.getpass("Confirm password: ")
    if password != confirmation:
        raise SystemExit("Passwords do not match")
    if len(password) < 8:
        raise SystemExit("Password must contain at least 8 characters")

    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.username == args.username))
        if user is None:
            user = User(
                username=args.username,
                full_name=args.full_name,
                email=args.email,
                role="admin",
                is_active=True,
                password_hash=hash_password(password),
            )
            db.add(user)
        else:
            user.full_name = args.full_name
            user.email = args.email
            user.role = "admin"
            user.is_active = True
            user.password_hash = hash_password(password)

        db.commit()
        print(f"Admin user ready: {user.username}")


if __name__ == "__main__":
    main()
