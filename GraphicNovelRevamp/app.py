from flask import Flask, render_template, request, jsonify, redirect, url_for, flash
from flask_login import LoginManager, UserMixin, login_required, login_user, logout_user, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from services.ai_scene_service import suggest_scene_details, enhance_panel_layout
import cv2
import numpy as np
from functools import wraps
def retry_on_db_error(max_retries=3, delay=1):
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            retries = 0
            while retries < max_retries:
                try:
                    return f(*args, **kwargs)
                except Exception as e:
                    if "SSL connection has been closed unexpectedly" in str(e):
                        retries += 1
                        if retries == max_retries:
                            raise
                        time.sleep(delay)
                        # Force reconnection
                        db.session.remove()
                        continue
                    raise
            return f(*args, **kwargs)
        return wrapper
    return decorator

import time
from urllib.parse import urlparse
import requests
from bs4 import BeautifulSoup
import re
from werkzeug.utils import secure_filename
import os
from flask_sqlalchemy import SQLAlchemy
import json

app = Flask(__name__)
# Ensure backgrounds directory exists
os.makedirs(os.path.join('static', 'backgrounds'), exist_ok=True)
app.config['SECRET_KEY'] = os.environ.get('FLASK_SECRET_KEY', 'default-secret-key')
# Configure database with SSL
db_url = os.environ.get('DATABASE_URL', 'sqlite:///comic.db')
if 'postgresql' in db_url:
    # Add SSL parameters
    db_url = db_url.replace('postgres://', 'postgresql://')
    if '?' not in db_url:
        db_url += '?sslmode=require'
app.config['SQLALCHEMY_DATABASE_URI'] = db_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
    'pool_pre_ping': True,  # Enable connection health checks
    'pool_recycle': 1800    # Recycle connections after 30 minutes
}
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

db = SQLAlchemy(app)
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

# Rate limiting configuration
RATE_LIMIT = 60  # seconds
last_request_time = {}

def rate_limit(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user_id = current_user.id if current_user.is_authenticated else 'anonymous'
        current_time = time.time()
        if user_id in last_request_time:
            time_passed = current_time - last_request_time[user_id]
            if time_passed < RATE_LIMIT:
                return jsonify({
                    'success': False,
                    'error': f'Please wait {int(RATE_LIMIT - time_passed)} seconds before making another request'
                }), 429
        last_request_time[user_id] = current_time
        return f(*args, **kwargs)
    return decorated_function

def sanitize_content(content):
    soup = BeautifulSoup(content, 'lxml')
    text = soup.get_text()
    text = re.sub(r'\s+', ' ', text).strip()
    text = re.sub(r'<script.*?</script>', '', text, flags=re.DOTALL)
    return text

def is_allowed_domain(url):
    allowed_domains = [
        'gutenberg.org',
        'archive.org',
        'archiveofourown.org',
        'fanfiction.net'
    ]
    domain = urlparse(url).netloc
    return any(allowed in domain for allowed in allowed_domains)

@login_manager.user_loader
@retry_on_db_error()
def load_user(user_id):
    from models import User
    return User.query.get(int(user_id))

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/editor')
@login_required
def editor():
    return render_template('editor.html')

@app.route('/save_comic', methods=['POST'])
@login_required
@retry_on_db_error()
def save_comic():
    try:
        from models import Comic
        data = request.json
        comic = Comic(
            title=data['title'],
            content=data['content'],
            user_id=current_user.id
        )
        db.session.add(comic)
        db.session.commit()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        from models import User
        email = request.form.get('email')
        password = request.form.get('password')
        user = User.query.filter_by(email=email).first()
        
        if user and check_password_hash(user.password_hash, password):
            login_user(user)
            return redirect(url_for('editor'))
        flash('Invalid email or password')
    return render_template('login.html')

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        from models import User
        username = request.form.get('username')
        email = request.form.get('email')
        password = request.form.get('password')
        confirm_password = request.form.get('confirm_password')

        if User.query.filter_by(username=username).first():
            flash('Username already exists')
            return render_template('register.html')
        
        if User.query.filter_by(email=email).first():
            flash('Email already registered')
            return render_template('register.html')
        
        if password != confirm_password:
            flash('Passwords do not match')
            return render_template('register.html')
        
        user = User(
            username=username,
            email=email,
            password_hash=generate_password_hash(password)
        )
        db.session.add(user)
        db.session.commit()
        
        login_user(user)
        return redirect(url_for('editor'))
    return render_template('register.html')

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('index'))

@app.route('/upload_text', methods=['POST'])
@app.route('/upload_background', methods=['POST'])
@login_required
def upload_background():
    try:
        if 'file' not in request.files:
            return jsonify({'success': False, 'error': 'No file uploaded'})
        
        file = request.files['file']
        if not file.filename:
            return jsonify({'success': False, 'error': 'No file selected'})
        
        filename = secure_filename(file.filename)
        file_extension = os.path.splitext(filename)[1].lower()
        
        # Only allow SVG and common image formats
        if file_extension not in ['.svg', '.png', '.jpg', '.jpeg']:
            return jsonify({'success': False, 'error': 'Invalid file format'})
        
        # Save file to backgrounds directory
        file_path = os.path.join('static', 'backgrounds', filename)
        file.save(file_path)
        
        # Return the path relative to static directory
        return jsonify({
            'success': True,
            'filename': filename,
            'path': f'/static/backgrounds/{filename}'
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})
@login_required
def upload_text():
    try:
        if 'file' not in request.files:
            return jsonify({'success': False, 'error': 'No file uploaded'})
        
        file = request.files['file']
        if not file.filename:
            return jsonify({'success': False, 'error': 'No file selected'})
        
        filename = secure_filename(file.filename)
        file_path = os.path.join('uploads', filename)
        file.save(file_path)
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Get scene suggestions for the content
            suggestions = suggest_scene_details(content[:1000])
            
            return jsonify({
                'success': True,
                'content': content,
                'scenes': suggestions.get('scenes', [])
            })
        finally:
            if os.path.exists(file_path):
                os.remove(file_path)
                
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/upload_video', methods=['POST'])
@login_required
def upload_video():
    try:
        if 'file' not in request.files:
            return jsonify({'success': False, 'error': 'No file uploaded'})
        
        file = request.files['file']
        if not file.filename:
            return jsonify({'success': False, 'error': 'No file selected'})
        
        filename = secure_filename(file.filename)
        file_path = os.path.join('uploads', filename)
        file.save(file_path)
        
        try:
            cap = cv2.VideoCapture(file_path)
            frames = []
            frame_count = 0
            
            while cap.isOpened() and frame_count < 6:
                ret, frame = cap.read()
                if not ret:
                    break
                    
                _, buffer = cv2.imencode('.jpg', frame)
                frame_base64 = buffer.tobytes()
                frames.append(frame_base64)
                frame_count += 1
                cap.set(cv2.CAP_PROP_POS_FRAMES, frame_count * 30)  # Skip frames
            
            cap.release()
            return jsonify({
                'success': True,
                'frames': frames
            })
        finally:
            if os.path.exists(file_path):
                os.remove(file_path)
                
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/import_url', methods=['POST'])
@login_required
@rate_limit
def import_url():
    try:
        data = request.json
        url = data.get('url')
        
        if not url:
            return jsonify({'success': False, 'error': 'No URL provided'}), 400

        # Validate URL
        try:
            parsed_url = urlparse(url)
            if not all([parsed_url.scheme, parsed_url.netloc]):
                raise ValueError('Invalid URL format')
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 400

        # Check if domain is allowed
        if not is_allowed_domain(url):
            return jsonify({
                'success': False,
                'error': 'Domain not allowed. Please use supported content sources.'
            }), 403

        # Fetch content with timeout
        response = requests.get(url, timeout=10, headers={
            'User-Agent': 'Mozilla/5.0 (compatible; ComicCreatorBot/1.0)'
        })
        response.raise_for_status()

        # Sanitize and process content
        content = sanitize_content(response.text)
        
        # Get AI scene suggestions for the content
        suggestions = suggest_scene_details(content[:1000])
        
        return jsonify({
            'success': True,
            'content': content,
            'scenes': suggestions.get('scenes', [])
        })

    except requests.RequestException as e:
        return jsonify({'success': False, 'error': 'Failed to fetch content'}), 500
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/suggest_scenes', methods=['POST'])
@login_required
def suggest_scenes():
    try:
        data = request.json
        text = data.get('text', '')
        if not text:
            return jsonify({'error': 'No text provided'}), 400

        # Get scene suggestions from OpenAI
        suggestions = suggest_scene_details(text)
        
        # Enhance layout based on scene count
        layout_suggestion = enhance_panel_layout(len(suggestions.get('scenes', [])))
        
        return jsonify({
            'scenes': suggestions.get('scenes', []),
            'layout': layout_suggestion
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)