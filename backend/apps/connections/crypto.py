from django.conf import settings
from cryptography.fernet import Fernet


def _fernet() -> Fernet:
    # The key was validated in settings.py at startup; a failure here means the
    # key changed after ciphertext was written.
    return Fernet(settings.DBENCH_ENCRYPTION_KEY.encode())


def encrypt(plaintext: str) -> str:
    return _fernet().encrypt(plaintext.encode()).decode()


def decrypt(token: str) -> str:
    return _fernet().decrypt(token.encode()).decode()
