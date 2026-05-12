// Volt Pro Admin Dashboard JavaScript
class VoltProAdmin {
    constructor() {
        this.projectsData = null;
        this.currentEditingProject = null;
        this.autoSaveEnabled = true;
        this.init();
    }

    async init() {
        await this.loadProjectsData();
        this.setupEventListeners();
        this.renderProjects();
        this.loadSiteSettings();
    }

    // Load projects data from Decap CMS structure
    async loadProjectsData() {
        try {
            // Load settings
            const settingsResponse = await fetch('data/settings.json');
            const settings = await settingsResponse.json();
            
            // Load WIP projects (under construction)
            const wipResponse = await fetch('data/wip/index.json');
            let wipProjects = [];
            try {
                wipProjects = await wipResponse.json();
            } catch (e) {
                // If index.json doesn't exist, try to load individual files
                wipProjects = await this.loadMarkdownFiles('data/wip');
            }
            
            // Load completed projects
            const doneResponse = await fetch('data/done/index.json');
            let completedProjects = [];
            try {
                completedProjects = await doneResponse.json();
            } catch (e) {
                // If index.json doesn't exist, try to load individual files
                completedProjects = await this.loadMarkdownFiles('data/done');
            }
            
            this.projectsData = {
                projects: {
                    under_construction: wipProjects,
                    completed: completedProjects
                },
                site_config: settings
            };
            
            // Validate parsed data
            if (!this.projectsData || !this.projectsData.projects) {
                throw new Error('Invalid project data structure');
            }
            
            console.log('Projects data loaded successfully:', this.projectsData);
        } catch (error) {
            console.error('Error loading projects data:', error);
            this.showMessage('خطأ في تحميل بيانات المشاريع: ' + error.message, 'error');
            // Load fallback data
            this.loadFallbackData();
        }
    }

    // Load markdown files from a directory
    async loadMarkdownFiles(directory) {
        try {
            // Try to get file list (this might not work on all servers)
            const response = await fetch(`${directory}/`);
            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            
            const links = Array.from(doc.querySelectorAll('a[href$=".md"]'));
            const files = [];
            
            for (const link of links) {
                const filename = link.getAttribute('href');
                if (filename && filename.endsWith('.md')) {
                    try {
                        const fileResponse = await fetch(`${directory}/${filename}`);
                        const markdown = await fileResponse.text();
                        const project = this.parseMarkdownProject(markdown, filename);
                        if (project) {
                            files.push(project);
                        }
                    } catch (e) {
                        console.warn(`Failed to load ${filename}:`, e);
                    }
                }
            }
            
            return files;
        } catch (error) {
            console.warn(`Could not load files from ${directory}:`, error);
            return [];
        }
    }

    // Parse markdown project file
    parseMarkdownProject(markdown, filename) {
        try {
            // Extract frontmatter
            const frontmatterMatch = markdown.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
            if (!frontmatterMatch) {
                return null;
            }
            
            const frontmatter = frontmatterMatch[1];
            const content = frontmatterMatch[2];
            
            // Parse YAML frontmatter
            const project = this.parseYamlFrontmatter(frontmatter);
            
            // Generate ID from filename
            project.id = filename.replace('.md', '').replace(/[^a-zA-Z0-9]/g, '-');
            
            // Use content if no description in frontmatter
            if (!project.description && content) {
                project.description = content.trim();
            }
            
            return project;
        } catch (error) {
            console.error(`Error parsing ${filename}:`, error);
            return null;
        }
    }

    // Simple YAML frontmatter parser
    parseYamlFrontmatter(yamlText) {
        const project = {};
        const lines = yamlText.split('\n');
        
        for (const line of lines) {
            const match = line.match(/^(\w+):\s*(.+)$/);
            if (match) {
                const key = match[1];
                let value = match[2];
                
                // Handle quotes
                if ((value.startsWith('"') && value.endsWith('"')) || 
                    (value.startsWith("'") && value.endsWith("'"))) {
                    value = value.slice(1, -1);
                }
                
                // Handle arrays (images)
                if (key === 'images') {
                    project[key] = [];
                    // Simple array parsing
                    const arrayMatch = value.match(/^\s*\[(.*)\]\s*$/);
                    if (arrayMatch) {
                        const items = arrayMatch[1].split(',').map(item => {
                            item = item.trim();
                            if ((item.startsWith('"') && item.endsWith('"')) || 
                                (item.startsWith("'") && item.endsWith("'"))) {
                                item = item.slice(1, -1);
                            }
                            return item;
                        });
                        project[key] = items;
                    }
                } else {
                    project[key] = value;
                }
            }
        }
        
        return project;
    }

    // Parse projects from HTML content
    parseProjectsFromHTML(htmlText) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlText, 'text/html');
        
        const projectsData = {
            projects: {
                under_construction: [],
                completed: []
            },
            site_config: this.parseSiteConfig(doc)
        };

        // Parse under construction projects
        const underConstructionSection = doc.querySelector('#portfolio');
        if (underConstructionSection) {
            const underConstructionProjects = underConstructionSection.querySelectorAll('.portfolio-item');
            underConstructionProjects.forEach((item, index) => {
                const project = this.parseProjectFromElement(item, `under_construction_${index}`);
                if (project) {
                    projectsData.projects.under_construction.push(project);
                }
            });
        }

        // Parse completed projects
        const completedSection = doc.querySelector('#completed-projects');
        if (completedSection) {
            const completedProjects = completedSection.querySelectorAll('.portfolio-item');
            completedProjects.forEach((item, index) => {
                const project = this.parseProjectFromElement(item, `completed_${index}`);
                if (project) {
                    projectsData.projects.completed.push(project);
                }
            });
        }

        return projectsData;
    }

    // Parse project from DOM element
    parseProjectFromElement(element, defaultId) {
        try {
            const titleElement = element.querySelector('.project-header h3');
            const descriptionElement = element.querySelector('.project-description p');
            const images = Array.from(element.querySelectorAll('.images img'));
            
            if (!titleElement || !descriptionElement) {
                console.warn('Missing required elements for project:', element);
                return null;
            }

            // Extract project info from title and description
            const title = titleElement.textContent.trim();
            const description = descriptionElement.textContent.trim();
            
            // Generate ID from title or use default
            const id = this.generateProjectId(title) || defaultId;
            
            // Extract image sources
            const imageSources = images.map(img => img.src || img.getAttribute('src')).filter(src => src);
            
            // Try to extract additional info from description
            const year = this.extractYear(description);
            const client = this.extractClient(description);
            const category = this.inferCategory(title, description);

            return {
                id,
                title,
                description,
                images: imageSources,
                year,
                client,
                category
            };
        } catch (error) {
            console.error('Error parsing project from element:', error);
            return null;
        }
    }

    // Generate project ID from title
    generateProjectId(title) {
        if (!title) return null;
        
        // Remove Arabic diacritics and convert to simple format
        const cleanTitle = title
            .replace(/[^\u0621-\u064A\s]/g, '') // Keep Arabic letters and spaces
            .replace(/\s+/g, '_')
            .toLowerCase();
        
        // Map common Arabic terms to English
        const mappings = {
            'شركة': 'company',
            'مصنع': 'factory',
            'نادي': 'club',
            'فيلا': 'villa',
            'شقة': 'apartment',
            'سمارت': 'smart',
            'هوم': 'home',
            'الرياض': 'riyadh',
            'الرحاب': 'rehab',
            'الشروق': 'shurooq',
            'الراشد': 'rashid'
        };

        let id = cleanTitle;
        Object.keys(mappings).forEach(arabic => {
            id = id.replace(new RegExp(arabic, 'g'), mappings[arabic]);
        });

        return id.replace(/_+/g, '_').replace(/^_|_$/g, '') || null;
    }

    // Extract year from description
    extractYear(description) {
        const yearMatch = description.match(/(\d{4})/);
        return yearMatch ? yearMatch[1] : null;
    }

    // Extract client from description
    extractClient(description) {
        // Look for common client patterns
        const clientPatterns = [
            /لـ?\s*([^،.\n]+?)(?:\s|،|\.|$)/,
            /شركة\s+([^،.\n]+?)(?:\s|،|\.|$)/,
            /نادي\s+([^،.\n]+?)(?:\s|،|\.|$)/,
            /فيلا\s+([^،.\n]+?)(?:\s|،|\.|$)/,
            /شقة\s+([^،.\n]+?)(?:\s|،|\.|$)/
        ];

        for (const pattern of clientPatterns) {
            const match = description.match(pattern);
            if (match && match[1] && match[1].trim().length > 2) {
                return match[1].trim();
            }
        }

        return null;
    }

    // Infer category from title and description
    inferCategory(title, description) {
        const text = (title + ' ' + description).toLowerCase();
        
        if (text.includes('مصنع') || text.includes('صناعي')) {
            return 'industrial';
        } else if (text.includes('نادي') || text.includes('رياضي')) {
            return 'sports';
        } else if (text.includes('شركة') || text.includes('مبنى') || text.includes('إداري')) {
            return 'commercial';
        } else {
            return 'residential';
        }
    }

    // Parse site configuration from HTML
    parseSiteConfig(doc) {
        const config = {
            company_name: 'Volt Pro',
            company_tagline: 'مجموعة الصناعيين والحرفيين المتخصصين',
            contact: {
                phone: '+966573423623',
                whatsapp: '0573423623',
                email: 'info@voltpro.com'
            },
            social: {}
        };

        // Extract company name from title or logo
        const titleElement = doc.querySelector('title');
        if (titleElement) {
            const titleText = titleElement.textContent;
            const nameMatch = titleText.match(/^([^|]+)/);
            if (nameMatch) {
                config.company_name = nameMatch[1].trim();
            }
        }

        // Extract logo text
        const logoElement = doc.querySelector('.logo');
        if (logoElement) {
            const logoText = logoElement.textContent.trim();
            if (logoText && logoText !== 'Volt Pro') {
                config.company_name = logoText;
            }
        }

        // Extract WhatsApp links
        const whatsappLinks = doc.querySelectorAll('a[href*="wa.me"], a[href*="whatsapp"]');
        whatsappLinks.forEach(link => {
            const href = link.getAttribute('href');
            if (href.includes('wa.me/')) {
                const number = href.replace('https://wa.me/', '').replace(/\D/g, '');
                config.contact.whatsapp = number;
            }
        });

        // Extract social links
        const socialLinks = doc.querySelectorAll('.social-links a');
        socialLinks.forEach(link => {
            const href = link.getAttribute('href');
            if (href.includes('instagram')) {
                config.social.instagram = href;
            } else if (href.includes('linkedin')) {
                config.social.linkedin = href;
            } else if (href.includes('facebook')) {
                config.social.facebook = href;
            } else if (href.includes('twitter')) {
                config.social.twitter = href;
            }
        });

        return config;
    }

    // Load fallback data
    loadFallbackData() {
        console.log('Loading fallback data...');
        this.projectsData = {
            projects: {
                under_construction: [
                    {
                        id: "rashid",
                        title: "شركة الراشد - تأسيس الأعمال الكهربائية ونظام إنذار الحريق",
                        description: "التأسيس الكامل للأنظمة الكهربائية وشبكة إنذار الحريق (Fire Alarm) للمبنى الإداري، مع استخدام مواسير الـ EMT المعدنية لضمان أقصى درجات الحماية والأمان والمظهر المهني المنظم. يتم العمل وفق المخططات الهندسية المعتمدة مع مراعاة الدقة المتناهية في المسارات وتوزيع الأحمال بما يتناسب مع احتياجات المباني الإدارية الحديثة.",
                        images: ["image/factory1.jpeg", "image/factory2.jpeg", "image/factory3.jpeg", "image/factory4.jpeg", "image/factory5.jpeg", "image/factory6.jpeg", "image/factory7.jpeg"],
                        status: "under_construction",
                        year: "2024",
                        client: "شركة الراشد",
                        category: "commercial"
                    }
                ],
                completed: [
                    {
                        id: "riyadh",
                        title: "نادي الرياض - البنية التحتية الكهربائية",
                        description: "تنفيذ البنية التحتية الكهربائية بالكامل لنادٍ رياضي بالرياض عام 2024، وفق أعلى معايير الدقة وتوزيع الأحمال، ليعمل بكفاءة واستقرار تام وبلا أي أعطال حتى اليوم.",
                        images: ["image/Riyadh1.jpeg", "image/Riyadh2.jpeg", "image/Riyadh3.jpeg", "image/Riyadh4.jpeg", "image/Riyadh5.jpeg", "image/Riyadh6.jpeg", "image/Riyadh7.jpeg"],
                        status: "completed",
                        year: "2024",
                        client: "نادي رياضي",
                        category: "sports"
                    },
                    {
                        id: "rehab",
                        title: "سمارت هوم - شقة الرحاب",
                        description: "تنفيذ نظام 'سمارت هوم' متكامل لشقة سكنية بالرحاب عام 2020، يشمل تأسيس أنظمة صوتية مستقلة لكل غرفة مرتبطة بالشاشات الذكية، وتوزيع أجهزة تقوية إشارة (Wi-Fi) لضمان تغطية كاملة. النظام يعمل بكفاءة تامة وبدون أعطال حتى اليوم، مع تقديم صيانة دورية وتحديثات مستمرة للأجهزة.",
                        images: ["image/Rehab1.jpeg", "image/Rehab2.jpeg", "image/Rehab5.jpeg", "image/Rehab4.jpeg", "image/Rehab5.jpeg"],
                        status: "completed",
                        year: "2020",
                        client: "شقة سكنية",
                        category: "residential"
                    },
                    {
                        id: "shurooq",
                        title: "فيلا الشروق - التأسيس الكهربائي",
                        description: "تأسيس وتشطيب كهرباء فيلا بالشروق عام 2019، تعمل بكفاءة تامة وبدون أعطال حتى اليوم، مع استمرار المتابعة مع العميل لتنفيذ أي إضافات أو تجديدات.",
                        images: ["image/sunrise1.jpeg", "image/sunrise2.jpeg", "image/sunrise3.jpeg", "image/sunrise4.jpeg", "image/sunrise5.jpeg"],
                        status: "completed",
                        year: "2019",
                        client: "فيلا سكنية",
                        category: "residential"
                    }
                ]
            },
            site_config: {
                company_name: "Volt Pro",
                company_tagline: "مجموعة الصناعيين والحرفيين المتخصصين",
                contact: {
                    phone: "+966573423623",
                    whatsapp: "0573423623",
                    email: "info@voltpro.com"
                },
                social: {
                    instagram: "https://www.instagram.com/voltprogroup",
                    linkedin: "https://www.linkedin.com/company/voltprogroup",
                    facebook: "https://www.facebook.com/alajadhalmtqnhllmqawlat",
                    twitter: "https://twitter.com/voltprogroup"
                }
            }
        };
        
        this.showMessage('تم تحميل البيانات الاحتياطية بنجاح', 'info');
    }

    // Setup event listeners
    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                this.switchSection(link.getAttribute('href').substring(1));
            });
        });

        // Project tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.switchProjectTab(btn.dataset.tab);
            });
        });

        // Buttons
        document.getElementById('saveBtn').addEventListener('click', () => this.saveAllChanges());
        document.getElementById('exportBtn').addEventListener('click', () => this.exportYAML());
        document.getElementById('addProjectBtn').addEventListener('click', () => this.openProjectModal());
        document.getElementById('saveProjectBtn').addEventListener('click', () => this.saveProject());
        document.getElementById('cancelBtn').addEventListener('click', () => this.closeProjectModal());
        document.getElementById('addImageBtn').addEventListener('click', () => this.addImageInput());

        // Modal
        document.querySelector('.close-btn').addEventListener('click', () => this.closeProjectModal());
        document.getElementById('projectModal').addEventListener('click', (e) => {
            if (e.target.id === 'projectModal') {
                this.closeProjectModal();
            }
        });

        // Auto-save
        document.getElementById('autoSave').addEventListener('change', (e) => {
            this.autoSaveEnabled = e.target.checked;
        });

        // Site settings
        document.querySelectorAll('#site input').forEach(input => {
            input.addEventListener('change', () => {
                if (this.autoSaveEnabled) {
                    this.saveSiteSettings();
                }
            });
        });
    }

    // Switch between sections
    switchSection(sectionId) {
        document.querySelectorAll('.section').forEach(section => {
            section.classList.remove('active');
        });
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });

        document.getElementById(sectionId).classList.add('active');
        document.querySelector(`[href="#${sectionId}"]`).classList.add('active');
    }

    // Switch project tabs
    switchProjectTab(tabName) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelectorAll('.projects-list').forEach(list => {
            list.classList.remove('active');
        });

        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        document.getElementById(tabName).classList.add('active');
    }

    // Render projects
    renderProjects() {
        if (!this.projectsData) return;

        // Render under construction projects
        const underConstructionContainer = document.getElementById('under_construction');
        underConstructionContainer.innerHTML = '';
        
        this.projectsData.projects.under_construction.forEach(project => {
            underConstructionContainer.appendChild(this.createProjectCard(project, 'under_construction'));
        });

        // Render completed projects
        const completedContainer = document.getElementById('completed');
        completedContainer.innerHTML = '';
        
        this.projectsData.projects.completed.forEach(project => {
            completedContainer.appendChild(this.createProjectCard(project, 'completed'));
        });
    }

    // Create project card
    createProjectCard(project, status) {
        const card = document.createElement('div');
        card.className = 'project-card';
        card.innerHTML = `
            <div class="project-header">
                <div>
                    <div class="project-title">${project.title}</div>
                    <div class="project-meta">
                        <span><i class="fas fa-calendar"></i> ${project.year || 'N/A'}</span>
                        <span><i class="fas fa-user"></i> ${project.client || 'N/A'}</span>
                        <span><i class="fas fa-tag"></i> ${this.getCategoryLabel(project.category)}</span>
                    </div>
                </div>
            </div>
            <div class="project-description">${project.description}</div>
            <div class="project-images">
                ${project.images.map(img => `<img src="${img}" alt="Project image" class="project-image">`).join('')}
            </div>
            <div class="project-actions">
                <button class="btn btn-info btn-sm" onclick="admin.viewProjectDetails('${project.id}', '${status}')">
                    <i class="fas fa-eye"></i> عرض
                </button>
                <button class="btn btn-warning btn-sm" onclick="admin.editProject('${project.id}', '${status}')">
                    <i class="fas fa-edit"></i> تعديل
                </button>
                <button class="btn btn-danger btn-sm" onclick="admin.deleteProject('${project.id}', '${status}')">
                    <i class="fas fa-trash"></i> حذف
                </button>
            </div>
        `;
        return card;
    }

    // Get category label in Arabic
    getCategoryLabel(category) {
        const labels = {
            residential: 'سكني',
            commercial: 'تجاري',
            industrial: 'صناعي',
            sports: 'رياضي'
        };
        return labels[category] || category;
    }

    // Open project modal
    openProjectModal(project = null, status = 'under_construction') {
        const modal = document.getElementById('projectModal');
        const modalTitle = document.getElementById('modalTitle');
        const form = document.getElementById('projectForm');

        if (project) {
            modalTitle.textContent = 'تعديل مشروع';
            this.currentEditingProject = { ...project, status };
            form.projectId.value = project.id;
            form.projectId.disabled = true;
            form.projectTitle.value = project.title;
            form.projectDescription.value = project.description;
            form.projectStatus.value = status;
            form.projectYear.value = project.year || '';
            form.projectClient.value = project.client || '';
            form.projectCategory.value = project.category || 'residential';
            
            // Load images
            const imagesContainer = document.getElementById('imagesContainer');
            imagesContainer.innerHTML = '';
            project.images.forEach(img => {
                this.addImageInput(img);
            });
        } else {
            modalTitle.textContent = 'إضافة مشروع جديد';
            this.currentEditingProject = null;
            form.reset();
            form.projectId.disabled = false;
            document.getElementById('imagesContainer').innerHTML = `
                <div class="image-input-group">
                    <input type="text" class="image-input" placeholder="رابط الصورة">
                    <button type="button" class="btn btn-sm btn-danger remove-image">حذف</button>
                </div>
            `;
        }

        modal.classList.add('active');
    }

    // Close project modal
    closeProjectModal() {
        const modal = document.getElementById('projectModal');
        modal.classList.remove('active');
        this.currentEditingProject = null;
    }

    // Add image input
    addImageInput(value = '') {
        const imagesContainer = document.getElementById('imagesContainer');
        const imageGroup = document.createElement('div');
        imageGroup.className = 'image-input-group';
        imageGroup.innerHTML = `
            <input type="text" class="image-input" placeholder="رابط الصورة" value="${value}">
            <button type="button" class="btn btn-sm btn-danger remove-image">حذف</button>
        `;
        
        imageGroup.querySelector('.remove-image').addEventListener('click', () => {
            imageGroup.remove();
        });
        
        imagesContainer.appendChild(imageGroup);
    }

    // Save project
    saveProject() {
        const form = document.getElementById('projectForm');
        const formData = {
            id: form.projectId.value,
            title: form.projectTitle.value,
            description: form.projectDescription.value,
            status: form.projectStatus.value,
            year: form.projectYear.value,
            client: form.projectClient.value,
            category: form.projectCategory.value,
            images: Array.from(document.querySelectorAll('.image-input'))
                .map(input => input.value)
                .filter(value => value.trim() !== '')
        };

        // Validate
        if (!formData.id || !formData.title || !formData.description) {
            this.showMessage('يرجى ملء الحقول المطلوبة', 'error');
            return;
        }

        // Check for duplicate ID
        if (!this.currentEditingProject && this.isDuplicateId(formData.id, formData.status)) {
            this.showMessage('معرف المشروع موجود بالفعل', 'error');
            return;
        }

        // Save to data
        if (this.currentEditingProject) {
            // Update existing project
            this.updateProject(formData);
        } else {
            // Add new project
            this.addProject(formData);
        }

        this.closeProjectModal();
        this.renderProjects();
        this.showMessage('تم حفظ المشروع بنجاح', 'success');
        
        if (this.autoSaveEnabled) {
            this.saveAllChanges();
        }
    }

    // Check for duplicate ID
    isDuplicateId(id, status) {
        const projects = this.projectsData.projects[status];
        return projects.some(project => project.id === id);
    }

    // Add new project
    addProject(project) {
        this.projectsData.projects[project.status].push(project);
    }

    // Update existing project
    updateProject(updatedProject) {
        const oldStatus = this.currentEditingProject.status;
        const newStatus = updatedProject.status;

        // Remove from old status
        const oldProjects = this.projectsData.projects[oldStatus];
        const oldIndex = oldProjects.findIndex(p => p.id === updatedProject.id);
        if (oldIndex > -1) {
            oldProjects.splice(oldIndex, 1);
        }

        // Add to new status
        this.projectsData.projects[newStatus].push(updatedProject);
    }

    // Edit project
    editProject(projectId, status) {
        const project = this.projectsData.projects[status].find(p => p.id === projectId);
        if (project) {
            this.openProjectModal(project, status);
        }
    }

    // Delete project
    deleteProject(projectId, status) {
        if (confirm('هل أنت متأكد من حذف هذا المشروع؟')) {
            const projects = this.projectsData.projects[status];
            const index = projects.findIndex(p => p.id === projectId);
            if (index > -1) {
                projects.splice(index, 1);
                this.renderProjects();
                this.showMessage('تم حذف المشروع بنجاح', 'success');
                
                if (this.autoSaveEnabled) {
                    this.saveAllChanges();
                }
            }
        }
    }

    // Save all changes
    async saveAllChanges() {
        try {
            const yamlText = jsyaml.dump(this.projectsData, {
                indent: 2,
                lineWidth: 120,
                noRefs: true
            });

            // In a real implementation, this would save to the server
            console.log('Saving YAML:', yamlText);
            
            // For demo purposes, we'll just show success message
            this.showMessage('تم حفظ جميع التغييرات بنجاح', 'success');
        } catch (error) {
            console.error('Error saving changes:', error);
            this.showMessage('خطأ في حفظ التغييرات', 'error');
        }
    }

    // Export YAML
    exportYAML() {
        try {
            const yamlText = jsyaml.dump(this.projectsData, {
                indent: 2,
                lineWidth: 120,
                noRefs: true
            });

            const blob = new Blob([yamlText], { type: 'text/yaml' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'projects.yaml';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            this.showMessage('تم تصدير الملف بنجاح', 'success');
        } catch (error) {
            console.error('Error exporting YAML:', error);
            this.showMessage('خطأ في تصدير الملف', 'error');
        }
    }

    // Load site settings
    loadSiteSettings() {
        if (!this.projectsData?.site_config) return;

        const config = this.projectsData.site_config;
        
        // Company info
        document.getElementById('companyName').value = config.company_name || '';
        document.getElementById('companyTagline').value = config.company_tagline || '';
        
        // Contact info
        document.getElementById('phone').value = config.contact?.phone || '';
        document.getElementById('whatsapp').value = config.contact?.whatsapp || '';
        document.getElementById('email').value = config.contact?.email || '';
        
        // Social links
        document.getElementById('instagram').value = config.social?.instagram || '';
        document.getElementById('linkedin').value = config.social?.linkedin || '';
        document.getElementById('facebook').value = config.social?.facebook || '';
        document.getElementById('twitter').value = config.social?.twitter || '';
    }

    // Save site settings
    saveSiteSettings() {
        if (!this.projectsData) return;

        this.projectsData.site_config = {
            company_name: document.getElementById('companyName').value,
            company_tagline: document.getElementById('companyTagline').value,
            contact: {
                phone: document.getElementById('phone').value,
                whatsapp: document.getElementById('whatsapp').value,
                email: document.getElementById('email').value
            },
            social: {
                instagram: document.getElementById('instagram').value,
                linkedin: document.getElementById('linkedin').value,
                facebook: document.getElementById('facebook').value,
                twitter: document.getElementById('twitter').value
            },
            location: this.projectsData.site_config?.location || {
                city: "Riyadh",
                country: "SA",
                coordinates: {
                    latitude: "24.7136",
                    longitude: "46.6753"
                }
            }
        };

        if (this.autoSaveEnabled) {
            this.saveAllChanges();
        }
    }

    // View project details
    viewProjectDetails(projectId, status) {
        const project = this.projectsData.projects[status].find(p => p.id === projectId);
        if (!project) return;

        // Create detail modal
        const detailModal = document.createElement('div');
        detailModal.className = 'modal active';
        detailModal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>تفاصيل المشروع</h3>
                    <button class="close-btn">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="project-detail-grid">
                        <div class="detail-section">
                            <h4>معلومات المشروع</h4>
                            <div class="detail-item">
                                <label>العنوان:</label>
                                <span>${project.title}</span>
                            </div>
                            <div class="detail-item">
                                <label>المعرف:</label>
                                <span>${project.id}</span>
                            </div>
                            <div class="detail-item">
                                <label>الحالة:</label>
                                <span>${status === 'under_construction' ? 'تحت الإنشاء' : 'مكتمل'}</span>
                            </div>
                            <div class="detail-item">
                                <label>السنة:</label>
                                <span>${project.year || 'N/A'}</span>
                            </div>
                            <div class="detail-item">
                                <label>العميل:</label>
                                <span>${project.client || 'N/A'}</span>
                            </div>
                            <div class="detail-item">
                                <label>الفئة:</label>
                                <span>${this.getCategoryLabel(project.category)}</span>
                            </div>
                        </div>
                        
                        <div class="detail-section">
                            <h4>الوصف</h4>
                            <p>${project.description}</p>
                        </div>
                        
                        <div class="detail-section">
                            <h4>الصور (${project.images.length})</h4>
                            <div class="detail-images">
                                ${project.images.map(img => `
                                    <div class="detail-image-container">
                                        <img src="${img}" alt="Project image" class="detail-image">
                                        <div class="image-overlay">
                                            <i class="fas fa-search-plus"></i>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">إغلاق</button>
                    <button type="button" class="btn btn-warning" onclick="admin.editProject('${project.id}', '${status}'); this.closest('.modal').remove();">
                        <i class="fas fa-edit"></i> تعديل المشروع
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(detailModal);

        // Add click handlers
        detailModal.querySelector('.close-btn').addEventListener('click', () => {
            detailModal.remove();
        });

        detailModal.addEventListener('click', (e) => {
            if (e.target === detailModal) {
                detailModal.remove();
            }
        });

        // Add image click handlers for zoom
        detailModal.querySelectorAll('.detail-image-container').forEach((container, index) => {
            container.addEventListener('click', () => {
                this.zoomImage(project.images[index]);
            });
        });

        // Add escape key handler
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                detailModal.remove();
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
    }

    // Zoom image functionality
    zoomImage(imageSrc) {
        const zoomModal = document.createElement('div');
        zoomModal.className = 'modal active';
        zoomModal.innerHTML = `
            <div class="modal-content zoom-modal">
                <button class="close-btn">&times;</button>
                <img src="${imageSrc}" alt="Zoomed image" class="zoomed-image">
            </div>
        `;

        document.body.appendChild(zoomModal);

        // Add click handlers
        const closeZoom = () => {
            zoomModal.remove();
        };

        zoomModal.querySelector('.close-btn').addEventListener('click', closeZoom);
        zoomModal.addEventListener('click', (e) => {
            if (e.target === zoomModal || e.target.classList.contains('zoomed-image')) {
                closeZoom();
            }
        });

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                closeZoom();
            }
        });
    }

    // Show message
    showMessage(message, type = 'info') {
        const messageDiv = document.createElement('div');
        messageDiv.className = `${type}-message`;
        messageDiv.textContent = message;
        
        const container = document.querySelector('.content-area');
        container.insertBefore(messageDiv, container.firstChild);
        
        setTimeout(() => {
            messageDiv.remove();
        }, 3000);
    }
}

// Initialize admin dashboard
const admin = new VoltProAdmin();

// Make admin globally accessible for onclick handlers
window.admin = admin;
