@echo off
echo Initializing Git repository...
cd /d "d:\tony"
git init

echo Adding all files...
git add .

echo Creating initial commit...
git commit -m "Initial commit: Volt Pro website with admin dashboard

Features:
- Complete website with portfolio projects
- Advanced admin dashboard with YAML management
- Project CRUD operations
- Responsive design
- Image gallery functionality
- Arabic language support
- Mobile-friendly interface

Changes:
- Added admin.html for project management
- Created data/projects.yaml for structured data
- Added js/admin.js for admin functionality
- Added js/yaml-loader.js for dynamic loading
- Updated css/admin.css for admin interface
- Enhanced main site with dynamic loading from HTML"

echo Git repository initialized successfully!
echo.
pause
