# Mat-Booking-System

Matatu booking system for travel ease.

**Quick start — run locally (Windows)**

Prerequisites:

- `Python 3.10+`
- Git (optional)

Steps:

1. Open a terminal and change to the project root (where this README lives):

```powershell
cd "Mat-Booking-System"
```

2. Create and activate a virtual environment:

```powershell
python -m venv venv
venv\Scripts\activate
```

3. Install dependencies:

```powershell
pip install -r matatu_booking/requirements.txt
```

4. Create a `.env` file in the project `matatu_booking` folder with the required keys used by the project. Example `.env` content
Login to daraja api and get your credentials:


```
CONSUMER_KEY=your_consumer_key
PASSKEY=your_passkey
CONSUMER_SECRET=your_consumer_secret
```

Place the `.env` file at: `matatu_booking/.env` (next to `manage.py`).

5. Run migrations and create a superuser:

```powershell
cd matatu_booking
python manage.py migrate
python manage.py createsuperuser
```

6. Start the development server:

```powershell
python manage.py runserver
```

7. Open your browser at `http://127.0.0.1:8000/` and log in (if necessary) with the superuser credentials.

Notes and troubleshooting:

- The project uses SQLite by default (`db.sqlite3`) located in the `matatu_booking` folder. Running `migrate` is safe even if the file already exists.
- Static files are served automatically by Django during development. Uploaded media (QR codes) are stored in the `media/qr_codes` folder — ensure this folder is writable.
- The settings file expects a `.env` file with `CONSUMER_KEY`, `PASSKEY`, and `CONSUMER_SECRET`. Without these, parts of the payments integration may raise errors.
- If you run into import errors for `environ`, ensure the virtual environment is activated and `django-environ` is installed via the `requirements.txt` step.
- For production deployment, set `DEBUG=False`, secure the `SECRET_KEY`, and configure allowed hosts and a production database.

