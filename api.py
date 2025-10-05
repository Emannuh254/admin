import os
import sqlite3
from datetime import datetime
from flask import Flask, request, jsonify, g
from flask_cors import CORS
from werkzeug.exceptions import HTTPException

# Database Configuration
DATABASE = 'jobs.db'
SCHEMA = """
CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    company TEXT NOT NULL,
    location TEXT NOT NULL,
    type TEXT NOT NULL,
    salary TEXT,
    tags TEXT,
    description TEXT,
    requirements TEXT,
    application_link TEXT,
    date_posted TEXT NOT NULL
);
"""

# Flask App Initialization
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})  # Enable CORS for all routes with all origins

# Database Connection Management
def get_db():
    db = getattr(g, '_database', None)
    if db is None:
        db = g._database = sqlite3.connect(DATABASE)
        db.row_factory = sqlite3.Row
    return db

@app.teardown_appcontext
def close_connection(exception):
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()

# Database Initialization
def init_db():
    with app.app_context():
        db = get_db()
        cursor = db.cursor()
        cursor.execute(SCHEMA)
        db.commit()

# Health Check Endpoints (both /health and /api/health)
@app.route('/health', methods=['GET', 'OPTIONS'])
@app.route('/api/health', methods=['GET', 'OPTIONS'])
def health_check():
    if request.method == 'OPTIONS':
        return '', 200  # Handle preflight requests
    return jsonify({"status": "healthy"})

# Get Jobs - Handle both /jobs/ and /api/jobs/
def get_jobs_handler():
    db = get_db()
    cursor = db.cursor()
    
    # Get query parameters
    page = int(request.args.get('page', 1))
    limit = int(request.args.get('limit', 10))
    search = request.args.get('search', '')
    
    # Calculate offset for pagination
    offset = (page - 1) * limit
    
    # Build query with optional search
    query = "SELECT * FROM jobs"
    params = []
    
    if search:
        query += " WHERE title LIKE ? OR company LIKE ? OR location LIKE ? OR tags LIKE ?"
        params.extend([f'%{search}%', f'%{search}%', f'%{search}%', f'%{search}%'])
    
    query += " ORDER BY date_posted DESC LIMIT ? OFFSET ?"
    params.extend([limit, offset])
    
    cursor.execute(query, params)
    jobs = [dict(job) for job in cursor.fetchall()]
    
    return jsonify(jobs)

# Register get_jobs for both paths
@app.route('/jobs/', methods=['GET', 'OPTIONS'])
@app.route('/api/jobs/', methods=['GET', 'OPTIONS'])
def get_jobs():
    if request.method == 'OPTIONS':
        return '', 200  # Handle preflight requests
    return get_jobs_handler()

# Post Job - Handle both /jobs/post/ and /api/jobs/post/
def post_job_handler():
    data = request.get_json()
    
    # Validate required fields
    required_fields = ['title', 'company', 'location', 'type']
    for field in required_fields:
        if field not in data or not data[field]:
            return jsonify({"error": f"Field '{field}' is required"}), 400
    
    # Format tags if provided
    tags = data.get('tags', [])
    if isinstance(tags, list):
        tags = ', '.join(tags)
    
    # Create job record
    job = {
        'title': data['title'],
        'company': data['company'],
        'location': data['location'],
        'type': data['type'],
        'salary': data.get('salary', ''),
        'tags': tags,
        'description': data.get('description', ''),
        'requirements': data.get('requirements', ''),
        'application_link': data.get('application_link', ''),
        'date_posted': datetime.now().strftime('%Y-%m-%d')
    }
    
    db = get_db()
    cursor = db.cursor()
    
    # Insert job into database
    cursor.execute(
        """
        INSERT INTO jobs (title, company, location, type, salary, tags, description, requirements, application_link, date_posted)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            job['title'], job['company'], job['location'], job['type'], 
            job['salary'], job['tags'], job['description'], job['requirements'], 
            job['application_link'], job['date_posted']
        )
    )
    db.commit()
    
    # Return the created job with its ID
    job['id'] = cursor.lastrowid
    return jsonify(job), 201

# Register post_job for both paths
@app.route('/jobs/post/', methods=['POST', 'OPTIONS'])
@app.route('/api/jobs/post/', methods=['POST', 'OPTIONS'])
def post_job():
    if request.method == 'OPTIONS':
        return '', 200  # Handle preflight requests
    return post_job_handler()

# Get Job - Handle both /jobs/<id>/ and /api/jobs/<id>/
def get_job_handler(job_id):
    db = get_db()
    cursor = db.cursor()
    
    cursor.execute("SELECT * FROM jobs WHERE id = ?", (job_id,))
    job = cursor.fetchone()
    
    if job is None:
        return jsonify({"error": "Job not found"}), 404
    
    return jsonify(dict(job))

# Register get_job for both paths
@app.route('/jobs/<int:job_id>/', methods=['GET', 'OPTIONS'])
@app.route('/api/jobs/<int:job_id>/', methods=['GET', 'OPTIONS'])
def get_job(job_id):
    if request.method == 'OPTIONS':
        return '', 200  # Handle preflight requests
    return get_job_handler(job_id)

# Update Job - Handle both /jobs/<id>/ and /api/jobs/<id>/
def update_job_handler(job_id):
    data = request.get_json()
    
    # Check if job exists
    db = get_db()
    cursor = db.cursor()
    
    cursor.execute("SELECT * FROM jobs WHERE id = ?", (job_id,))
    job = cursor.fetchone()
    
    if job is None:
        return jsonify({"error": "Job not found"}), 404
    
    # Update fields if provided
    update_fields = {}
    for field in ['title', 'company', 'location', 'type', 'salary', 'description', 'requirements', 'application_link']:
        if field in data:
            update_fields[field] = data[field]
    
    # Handle tags separately
    if 'tags' in data:
        tags = data['tags']
        if isinstance(tags, list):
            tags = ', '.join(tags)
        update_fields['tags'] = tags
    
    # Build update query
    if update_fields:
        query = "UPDATE jobs SET "
        query += ", ".join([f"{field} = ?" for field in update_fields.keys()])
        query += " WHERE id = ?"
        
        params = list(update_fields.values())
        params.append(job_id)
        
        cursor.execute(query, params)
        db.commit()
    
    # Return updated job
    cursor.execute("SELECT * FROM jobs WHERE id = ?", (job_id,))
    updated_job = cursor.fetchone()
    return jsonify(dict(updated_job))

# Register update_job for both paths
@app.route('/jobs/<int:job_id>/', methods=['PUT', 'OPTIONS'])
@app.route('/api/jobs/<int:job_id>/', methods=['PUT', 'OPTIONS'])
def update_job(job_id):
    if request.method == 'OPTIONS':
        return '', 200  # Handle preflight requests
    return update_job_handler(job_id)

# Delete Job - Handle both /jobs/<id>/ and /api/jobs/<id>/
def delete_job_handler(job_id):
    db = get_db()
    cursor = db.cursor()
    
    # Check if job exists
    cursor.execute("SELECT * FROM jobs WHERE id = ?", (job_id,))
    job = cursor.fetchone()
    
    if job is None:
        return jsonify({"error": "Job not found"}), 404
    
    # Delete job
    cursor.execute("DELETE FROM jobs WHERE id = ?", (job_id,))
    db.commit()
    
    return jsonify({"message": "Job deleted successfully"})

# Register delete_job for both paths
@app.route('/jobs/<int:job_id>/', methods=['DELETE', 'OPTIONS'])
@app.route('/api/jobs/<int:job_id>/', methods=['DELETE', 'OPTIONS'])
def delete_job(job_id):
    if request.method == 'OPTIONS':
        return '', 200  # Handle preflight requests
    return delete_job_handler(job_id)

# Error Handling
@app.errorhandler(HTTPException)
def handle_exception(e):
    response = {
        "error": e.name,
        "message": e.description,
    }
    return jsonify(response), e.code

# Command Line Interface
if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='Job Board API Server')
    parser.add_argument('command', choices=['init', 'run', 'start'], 
                        help='Command to execute: init (initialize database), run/start (start server)')
    parser.add_argument('--port', type=int, default=8000, 
                        help='Port to run the server on (default: 8000)')
    parser.add_argument('--host', default='0.0.0.0', 
                        help='Host to bind the server to (default: 0.0.0.0)')
    
    args = parser.parse_args()
    
    if args.command == 'init':
        print("Initializing database...")
        init_db()
        print("Database initialized successfully!")
    elif args.command in ['run', 'start']:
        print(f"Starting server on {args.host}:{args.port}")
        app.run(host=args.host, port=args.port, debug=True)