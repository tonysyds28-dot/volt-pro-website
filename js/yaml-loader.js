// YAML Loader for Main Site
class YamlSiteLoader {
    constructor() {
        this.projectsData = null;
        this.init();
    }

    async init() {
        await this.loadProjectsData();
        this.renderProjects();
        this.updateSiteInfo();
        
        // Set up auto-refresh to sync with admin panel changes
        this.setupAutoRefresh();
    }

    // Setup auto-refresh to sync with admin panel
    setupAutoRefresh() {
        // Listen for storage changes from admin panel
        window.addEventListener('storage', (e) => {
            if (e.key === 'voltpro_settings' || 
                e.key === 'voltpro_under_construction_projects' || 
                e.key === 'voltpro_completed_projects') {
                console.log('Detected changes from admin panel, refreshing...');
                this.loadProjectsData().then(() => {
                    this.renderProjects();
                    this.updateSiteInfo();
                });
            }
        });
        
        // Also check for changes every 2 seconds (for same-tab updates)
        setInterval(() => {
            this.loadProjectsData().then(() => {
                this.renderProjects();
                this.updateSiteInfo();
            });
        }, 2000);
    }

    // Load projects data from Decap CMS structure
    async loadProjectsData() {
        try {
            // Try to load from localStorage first (to sync with admin panel)
            const savedSettings = localStorage.getItem('voltpro_settings');
            const savedWipProjects = localStorage.getItem('voltpro_under_construction_projects');
            const savedCompletedProjects = localStorage.getItem('voltpro_completed_projects');
            
            let settings, wipProjects, completedProjects;
            
            if (savedSettings && savedWipProjects && savedCompletedProjects) {
                // Load from localStorage (sync with admin panel)
                settings = JSON.parse(savedSettings);
                wipProjects = JSON.parse(savedWipProjects);
                completedProjects = JSON.parse(savedCompletedProjects);
                console.log('Loaded from localStorage (synced with admin panel)');
            } else {
                // Load from files (fallback)
                const settingsResponse = await fetch('data/settings.json');
                settings = await settingsResponse.json();
                
                const wipResponse = await fetch('data/wip/index.json');
                wipProjects = await wipResponse.json();
                
                const doneResponse = await fetch('data/done/index.json');
                completedProjects = await doneResponse.json();
                console.log('Loaded from files (fallback)');
            }
            
            this.projectsData = {
                projects: {
                    under_construction: wipProjects,
                    completed: completedProjects
                },
                site_config: settings
            };
            
            console.log('Projects data loaded successfully:', this.projectsData);
        } catch (error) {
            console.error('Error loading projects data:', error);
            // Fallback to hardcoded data if loading fails
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

    // Fallback data in case YAML fails to load
    loadFallbackData() {
        this.projectsData = {
            projects: {
                under_construction: [
                    {
                        id: "rashid",
                        title: "شركة الراشد - تأسيس الأعمال الكهربائية ونظام إنذار الحريق",
                        description: "التأسيس الكامل للأنظمة الكهربائية وشبكة إنذار الحريق (Fire Alarm) للمبنى الإداري، مع استخدام مواسير الـ EMT المعدنية لضمان أقصى درجات الحماية والأمان والمظهر المهني المنظم.",
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
                        description: "تنفيذ البنية التحتية الكهربائية بالكامل لنادٍ رياضي بالرياض عام 2024، وفق أعلى معايير الدقة وتوزيع الأحمال.",
                        images: ["image/Riyadh1.jpeg", "image/Riyadh2.jpeg", "image/Riyadh3.jpeg", "image/Riyadh4.jpeg", "image/Riyadh5.jpeg", "image/Riyadh6.jpeg", "image/Riyadh7.jpeg"],
                        status: "completed",
                        year: "2024",
                        client: "نادي رياضي",
                        category: "sports"
                    },
                    {
                        id: "rehab",
                        title: "سمارت هوم - شقة الرحاب",
                        description: "تنفيذ نظام 'سمارت هوم' متكامل لشقة سكنية بالرحاب عام 2020، يشمل تأسيس أنظمة صوتية مستقلة لكل غرفة مرتبطة بالشاشات الذكية.",
                        images: ["image/Rehab1.jpeg", "image/Rehab2.jpeg", "image/Rehab5.jpeg", "image/Rehab4.jpeg", "image/Rehab5.jpeg"],
                        status: "completed",
                        year: "2020",
                        client: "شقة سكنية",
                        category: "residential"
                    },
                    {
                        id: "shurooq",
                        title: "فيلا الشروق - التأسيس الكهربائي",
                        description: "تأسيس وتشطيب كهرباء فيلا بالشروق عام 2019، تعمل بكفاءة تامة وبدون أعطال حتى اليوم.",
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
    }

    // Render projects on main site
    renderProjects() {
        if (!this.projectsData) return;

        // Render under construction projects
        const underConstructionGrid = document.querySelector('#portfolio .portfolio-grid');
        if (underConstructionGrid) {
            underConstructionGrid.innerHTML = '';
            this.projectsData.projects.under_construction.forEach(project => {
                underConstructionGrid.appendChild(this.createProjectElement(project));
            });
        }

        // Render completed projects
        const completedGrid = document.querySelector('#completed-projects .portfolio-grid');
        if (completedGrid) {
            completedGrid.innerHTML = '';
            this.projectsData.projects.completed.forEach(project => {
                completedGrid.appendChild(this.createProjectElement(project));
            });
        }

        // Re-initialize image gallery functionality
        this.initializeImageGallery();
    }

    // Create project element
    createProjectElement(project) {
        const projectDiv = document.createElement('div');
        projectDiv.className = 'portfolio-item reveal';
        
        projectDiv.innerHTML = `
            <div class="project-header">
                <h3>${project.title}</h3>
            </div>
            <div class="images">
                ${project.images.map(img => `<img src="${img}" alt="${project.title}" loading="lazy">`).join('')}
            </div>
            <div class="project-description">
                <p>${project.description}</p>
            </div>
        `;
        
        return projectDiv;
    }

    // Update site information
    updateSiteInfo() {
        if (!this.projectsData?.site_config) return;

        const config = this.projectsData.site_config;

        // Update title
        const title = document.querySelector('title');
        if (title) {
            title.textContent = `${config.company_name} | ${config.company_tagline}`;
        }

        // Update logo
        const logo = document.querySelector('.logo');
        if (logo) {
            logo.innerHTML = `<i class="fas fa-bolt"></i> ${config.company_name.split(' ')[0]} <span>${config.company_name.split(' ')[1] || ''}</span>`;
        }

        // Update contact info
        const whatsappBtn = document.querySelector('.btn-primary[href*="wa.me"]');
        if (whatsappBtn && config.contact?.whatsapp) {
            whatsappBtn.href = `https://wa.me/${config.contact.whatsapp.replace(/\D/g, '')}`;
        }

        const whatsappFloat = document.querySelector('.whatsapp-float');
        if (whatsappFloat && config.contact?.whatsapp) {
            whatsappFloat.href = `https://wa.me/${config.contact.whatsapp.replace(/\D/g, '')}`;
        }

        // Update social links
        const socialLinks = document.querySelector('.social-links');
        if (socialLinks && config.social) {
            socialLinks.innerHTML = '';
            if (config.social.instagram) {
                socialLinks.innerHTML += `<a href="${config.social.instagram}"><i class="fab fa-instagram"></i></a>`;
            }
            if (config.social.linkedin) {
                socialLinks.innerHTML += `<a href="${config.social.linkedin}"><i class="fab fa-linkedin"></i></a>`;
            }
            if (config.social.facebook) {
                socialLinks.innerHTML += `<a href="${config.social.facebook}"><i class="fab fa-facebook"></i></a>`;
            }
            if (config.social.twitter) {
                socialLinks.innerHTML += `<a href="${config.social.twitter}"><i class="fab fa-twitter"></i></a>`;
            }
        }

        // Update meta tags
        this.updateMetaTags(config);
    }

    // Update meta tags
    updateMetaTags(config) {
        // Update description
        const description = document.querySelector('meta[name="description"]');
        if (description) {
            description.content = `${config.company_name} - ${config.company_tagline}. خدمات احترافية في الكهرباء والمنازل الذكية في الرياض.`;
        }

        // Update Open Graph tags
        const ogTitle = document.querySelector('meta[property="og:title"]');
        if (ogTitle) {
            ogTitle.content = `${config.company_name} | ${config.company_tagline}`;
        }

        const ogDescription = document.querySelector('meta[property="og:description"]');
        if (ogDescription) {
            ogDescription.content = `${config.company_name} - ${config.company_tagline}. خدمات احترافية في الكهرباء والمنازل الذكية في الرياض.`;
        }

        const ogSiteName = document.querySelector('meta[property="og:site_name"]');
        if (ogSiteName) {
            ogSiteName.content = config.company_name;
        }

        // Update Twitter tags
        const twitterTitle = document.querySelector('meta[name="twitter:title"]');
        if (twitterTitle) {
            twitterTitle.content = `${config.company_name} | ${config.company_tagline}`;
        }

        const twitterDescription = document.querySelector('meta[name="twitter:description"]');
        if (twitterDescription) {
            twitterDescription.content = `${config.company_name} - ${config.company_tagline}. خدمات احترافية في الكهرباء والمنازل الذكية في الرياض.`;
        }

        // Update structured data
        this.updateStructuredData(config);
    }

    // Update structured data
    updateStructuredData(config) {
        const structuredDataScript = document.querySelector('script[type="application/ld+json"]');
        if (structuredDataScript) {
            const structuredData = {
                "@context": "https://schema.org",
                "@type": "Organization",
                "name": config.company_name,
                "alternateName": config.company_tagline,
                "description": `${config.company_name} - ${config.company_tagline}. خدمات احترافية في الكهرباء والمنازل الذكية في الرياض.`,
                "telephone": config.contact?.phone || "",
                "address": {
                    "@type": "PostalAddress",
                    "addressLocality": "Riyadh",
                    "addressCountry": "SA"
                },
                "geo": {
                    "@type": "GeoCoordinates",
                    "latitude": "24.7136",
                    "longitude": "46.6753"
                },
                "openingHours": "Mo-Su 00:00-23:59",
                "serviceType": "Electrical Services",
                "areaServed": "Riyadh",
                "employee": {
                    "@type": "LocalBusiness",
                    "name": `${config.company_name} Team`
                },
                "offers": {
                    "@type": "Offer",
                    "itemOffered": {
                        "@type": "Service",
                        "name": "Electrical Installation and Smart Home Solutions",
                        "description": "Complete electrical installation, maintenance, and smart home automation by professional craftsmen"
                    }
                }
            };

            // Add social links if available
            if (config.social) {
                const sameAs = [];
                if (config.social.instagram) sameAs.push(config.social.instagram);
                if (config.social.linkedin) sameAs.push(config.social.linkedin);
                if (config.social.facebook) sameAs.push(config.social.facebook);
                if (config.social.twitter) sameAs.push(config.social.twitter);
                
                if (sameAs.length > 0) {
                    structuredData.sameAs = sameAs;
                }
            }

            structuredDataScript.textContent = JSON.stringify(structuredData, null, 2);
        }
    }

    // Initialize image gallery functionality
    initializeImageGallery() {
        const modal = document.getElementById('imageModal');
        const modalImg = document.getElementById('modalImage');
        const modalClose = document.querySelector('.modal-close');

        if (!modal || !modalImg || !modalClose) return;

        // Add click event to all portfolio images
        const portfolioImages = document.querySelectorAll('.portfolio-item img');
        
        portfolioImages.forEach(img => {
            img.addEventListener('click', function() {
                modal.classList.add('active');
                modalImg.src = this.src;
                modalImg.alt = this.alt;
                document.body.style.overflow = 'hidden';
            });
        });
        
        // Close modal events
        const closeModal = () => {
            modal.classList.remove('active');
            document.body.style.overflow = 'auto';
        };

        modalClose.addEventListener('click', closeModal);
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                closeModal();
            }
        });

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                closeModal();
            }
        });
    }
}

// Initialize YAML loader when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new YamlSiteLoader();
});
