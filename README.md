# Marvel-Style Comic Creator

A web-based tool that transforms text and video content into stunning Marvel-style graphic novels. Create dynamic comic panels from your stories with an intuitive interface and professional comic book styling.

## Description

This application allows users to convert their narratives into visually appealing comic book panels using advanced text analysis and panel generation. The standout feature is its ability to automatically convert natural language text into properly formatted comic panels, complete with Marvel-inspired styling and speech bubbles.

The tool also includes innovative video frame extraction capabilities, allowing users to create comic panels directly from video content, perfect for adapting video stories into comic book format.

## Features

### Content Conversion
- Text-to-panel automatic conversion with intelligent scene detection
- Video-to-comic frame extraction and panel generation
- Support for multiple input formats:
  - Plain text (TXT)
  - PDF documents
  - EPUB ebooks
  - HTML content

### Panel Management
- Dynamic panel layout options:
  - 2x2 grid layout
  - 3x2 grid layout
  - Single panel addition
- Marvel-style visual elements:
  - Comic-style borders
  - Speech bubbles
  - Dynamic text placement
  - Panel shadows and effects

### User Experience
- Auto-save functionality to prevent work loss
- Real-time panel editing and manipulation
- Export capabilities (PNG format)
- Responsive design for various screen sizes

## Installation

### Prerequisites
```bash
# Required Python version
python >= 3.11
```

### Dependencies
```toml
# Core dependencies
flask >= 3.1.0
flask-sqlalchemy >= 3.1.1
flask-login >= 0.6.3
email-validator >= 2.2.0

# File Processing
pillow >= 11.0.0
opencv-python >= 4.10.0.84
pypdf2 >= 3.0.1
ebooklib >= 0.18
beautifulsoup4 >= 4.12.3
lxml >= 5.3.0

# Database
psycopg2-binary >= 2.9.10
```

### Environment Variables
```bash
# Database Configuration
DATABASE_URL=postgresql://username:password@host:port/dbname
FLASK_SECRET_KEY=your_secret_key

# Optional API Keys (if needed)
OPENAI_API_KEY=your_openai_api_key  # If using AI features
```

### Setup Instructions
1. Clone the repository:
```bash
git clone <repository-url>
cd marvel-comic-creator
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Set up the database:
```bash
flask db upgrade
```

## Usage Guide

### Starting the Application
```bash
python main.py
```
The application will be available at `http://localhost:5000`

### Using the Editor

1. **Text to Comic Conversion**
   - Enter your story in the text input area
   - Use scene transitions (e.g., "meanwhile", "suddenly", "later")
   - Click anywhere outside the text area to generate panels

2. **File Upload**
   - Click "Upload Text File" to import TXT, PDF, EPUB, or HTML
   - Click "Upload Video" to import video files (MP4, AVI, MOV, WMV)
   - Maximum file size: 16MB

3. **Panel Manipulation**
   - Drag panels to reposition
   - Resize panels using corner handles
   - Use the layout buttons (2x2 or 3x2) to organize panels
   - Click "Add Single Panel" for custom layouts

4. **Saving and Exporting**
   - Work is automatically saved every 2 minutes
   - Click "Save Comic" to manually save
   - Use "Export as Image" to download as PNG

## Development

### Project Structure
```
├── static/
│   ├── backgrounds/    # Background templates
│   ├── css/           # Custom styling
│   └── js/            # Client-side logic
├── templates/         # Flask HTML templates
├── uploads/          # Temporary file storage
├── app.py            # Main Flask application
├── models.py         # Database models
└── main.py           # Application entry point
```

### Local Development Setup
1. Create a Python virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # Linux/Mac
venv\Scripts\activate     # Windows
```

2. Install development dependencies:
```bash
pip install -r requirements-dev.txt
```

3. Set up pre-commit hooks:
```bash
pre-commit install
```

### Database Configuration
The application uses PostgreSQL with SQLAlchemy ORM:

```python
# Database Models (models.py)
class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), unique=True)
    email = db.Column(db.String(120), unique=True)
    comics = db.relationship('Comic', backref='author')

class Comic(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200))
    content = db.Column(db.JSON)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'))
```

To initialize the database:
```bash
flask db init
flask db migrate
flask db upgrade
```
