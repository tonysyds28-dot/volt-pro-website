@echo off
echo Volt Pro Website - GitHub Upload Script
echo =====================================
echo.

cd /d "d:\tony"

echo Step 1: Initializing Git repository...
git init
if errorlevel 1 (
    echo Git already initialized or error occurred
    echo.
)

echo Step 2: Adding all files to Git...
git add .
if errorlevel 1 (
    echo Error adding files
    pause
    exit /b 1
)

echo Step 3: Creating commit...
git commit -m "Volt Pro Website - Complete Decap CMS Integration

Features:
- Full website with portfolio projects display
- Advanced admin dashboard with project management
- Decap CMS integration for content management
- Separate folders for WIP and completed projects
- Dynamic content loading from JSON files
- Responsive design with mobile support
- Arabic language interface
- Image gallery with zoom functionality
- Project filtering and categorization

Technical Details:
- Frontend: HTML5, CSS3, JavaScript
- CMS: Decap CMS with GitHub backend
- Deployment: Netlify ready
- Data structure: JSON files in data/ folder
- Admin panel: Complete CRUD operations
- No YAML dependency - pure JSON structure

Files Structure:
- index.html: Main website
- admin.html: Admin dashboard
- admin/config.yml: Decap CMS configuration
- data/settings.json: Site configuration
- data/wip/: Work in progress projects
- data/done/: Completed projects
- js/yaml-loader.js: Dynamic content loader
- js/admin.js: Admin panel functionality

This commit resolves the issue where Decap CMS was writing
directly to index.html, causing unwanted text display.
Now all content is properly separated into JSON files."

echo Step 4: Checking if remote repository exists...
git remote -v | findstr "origin" >nul
if errorlevel 1 (
    echo.
    echo No remote repository found.
    echo Please create a GitHub repository and run:
    echo git remote add origin https://github.com/YOUR_USERNAME/voltpro-website.git
    echo git push -u origin main
    echo.
    echo Then run this script again to push the changes.
) else (
    echo Step 5: Pushing to GitHub...
    git push -u origin main
    if errorlevel 1 (
        echo Error pushing to GitHub
        echo Please check your GitHub credentials and repository URL
    ) else (
        echo Successfully pushed to GitHub!
    )
)

echo.
echo =====================================
echo Volt Pro Website upload process completed!
echo.
echo Next steps:
echo 1. Connect this repository to Netlify
echo 2. Configure Decap CMS with your GitHub credentials
echo 3. Set up environment variables in Netlify if needed
echo.
pause
