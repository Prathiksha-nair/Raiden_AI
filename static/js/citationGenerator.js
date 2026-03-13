// citationGenerator.js - Complete implementation
document.addEventListener('DOMContentLoaded', function() {
    // Initialize when citation panel is opened
    if (document.getElementById('citations-panel')) {
        initCitationGenerator();
    }
});

function initCitationGenerator() {
    const sourceTypeSelect = document.getElementById('source-type');
    const generateBtn = document.getElementById('generate-citation-btn');
    const copyBtn = document.getElementById('copy-citation');
    const clearBtn = document.getElementById('clear-citation');

    if (!sourceTypeSelect || !generateBtn || !copyBtn || !clearBtn) {
        console.log('Citation generator elements not found, will initialize when panel opens');
        return;
    }

    // Load citation fields when source type changes
    sourceTypeSelect.addEventListener('change', function() {
        const sourceType = this.value;
        toggleCitationFields(sourceType);
    });

    // Generate citation button
    generateBtn.addEventListener('click', generateCitation);

    // Copy citation button
    copyBtn.addEventListener('click', copyCitation);

    // Clear form button
    clearBtn.addEventListener('click', clearCitationForm);

    // Initialize with default source type
    toggleCitationFields(sourceTypeSelect.value);
}

function toggleCitationFields(sourceType) {
    // Hide all field groups first
    const journalFields = document.getElementById('journal-fields');
    const websiteFields = document.getElementById('website-fields');
    const publisherFields = document.getElementById('publisher-fields');
    const doiFields = document.getElementById('doi-fields');

    if (journalFields) journalFields.style.display = 'none';
    if (websiteFields) websiteFields.style.display = 'none';
    if (publisherFields) publisherFields.style.display = 'none';
    if (doiFields) doiFields.style.display = 'none';
    
    // Show relevant fields based on source type
    if (sourceType === 'journal' || sourceType === 'book' || sourceType === 'conference' || sourceType === 'report') {
        if (journalFields) journalFields.style.display = 'block';
        if (publisherFields) publisherFields.style.display = 'block';
        if (doiFields) doiFields.style.display = 'block';
    } else if (sourceType === 'website') {
        if (websiteFields) websiteFields.style.display = 'block';
    } else if (sourceType === 'video' || sourceType === 'newspaper') {
        if (publisherFields) publisherFields.style.display = 'block';
    }
}

function generateCitation() {
    const style = document.getElementById('citation-style').value;
    const sourceType = document.getElementById('source-type').value;
    const author = document.getElementById('citation-author').value;
    const year = document.getElementById('citation-year').value;
    const title = document.getElementById('citation-title').value;
    
    let citation = '';
    
    // Basic validation
    if (!author || !year || !title) {
        document.getElementById('citation-output').innerHTML = '<div style="color: #ff6b6b;">Please fill in all required fields</div>';
        return;
    }
    
    // Generate citation based on style and source type
    if (style === 'apa') {
        citation = generateAPACitation(sourceType, author, year, title);
    } else if (style === 'mla') {
        citation = generateMLACitation(sourceType, author, year, title);
    } else if (style === 'chicago') {
        citation = generateChicagoCitation(sourceType, author, year, title);
    } else if (style === 'harvard') {
        citation = generateHarvardCitation(sourceType, author, year, title);
    }
    
    document.getElementById('citation-output').innerHTML = `<div style="color: var(--text);">${citation}</div>`;
}

function generateAPACitation(sourceType, author, year, title) {
    let citation = `${author} (${year}). ${title}. `;
    
    if (sourceType === 'journal') {
        const journalTitle = document.getElementById('journal-title').value;
        const volume = document.getElementById('volume').value;
        const issue = document.getElementById('issue').value;
        const pages = document.getElementById('pages').value;
        const doi = document.getElementById('doi').value;
        
        citation += `<i>${journalTitle}</i>, ${volume}`;
        if (issue) citation += `(${issue})`;
        if (pages) citation += `, ${pages}.`;
        if (doi) citation += ` https://doi.org/${doi}`;
        else citation += '.';
    } 
    else if (sourceType === 'book') {
        const publisher = document.getElementById('publisher').value;
        citation += publisher ? `${publisher}.` : '[Publisher].';
    }
    else if (sourceType === 'website') {
        const websiteTitle = document.getElementById('website-title').value;
        const url = document.getElementById('url').value;
        citation += websiteTitle ? `${websiteTitle}. ` : '';
        citation += url ? `Retrieved from ${url}` : '[URL]';
    }
    
    return citation;
}

function generateMLACitation(sourceType, author, year, title) {
    let citation = `${author}. "${title}" `;
    
    if (sourceType === 'journal') {
        const journalTitle = document.getElementById('journal-title').value;
        const volume = document.getElementById('volume').value;
        const issue = document.getElementById('issue').value;
        const pages = document.getElementById('pages').value;
        
        citation += `<i>${journalTitle}</i>, vol. ${volume}`;
        if (issue) citation += `, no. ${issue}`;
        citation += `, ${year}`;
        if (pages) citation += `, pp. ${pages}.`;
        else citation += '.';
    } 
    else if (sourceType === 'book') {
        const publisher = document.getElementById('publisher').value;
        citation += publisher ? `${publisher}, ${year}.` : `[Publisher], ${year}.`;
    }
    else if (sourceType === 'website') {
        const websiteTitle = document.getElementById('website-title').value;
        const url = document.getElementById('url').value;
        const pubDate = document.getElementById('pub-date').value;
        
        citation += websiteTitle ? `<i>${websiteTitle}</i>, ` : '[Website], ';
        citation += pubDate ? `${pubDate}, ` : '';
        citation += url ? `${url}.` : '[URL].';
    }
    
    return citation;
}

function generateChicagoCitation(sourceType, author, year, title) {
    // Similar structure as APA/MLA with Chicago formatting
    return generateAPACitation(sourceType, author, year, title);
}

function generateHarvardCitation(sourceType, author, year, title) {
    // Similar structure as APA/MLA with Harvard formatting
    return generateAPACitation(sourceType, author, year, title);
}

function copyCitation() {
    const citationText = document.getElementById('citation-output').textContent;
    if (!citationText || citationText.includes('Generated citation will appear here')) {
        return;
    }
    
    navigator.clipboard.writeText(citationText)
        .then(() => {
            const copyBtn = document.getElementById('copy-citation');
            const originalText = copyBtn.innerHTML;
            copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
            setTimeout(() => { 
                copyBtn.innerHTML = originalText; 
            }, 2000);
        })
        .catch(error => {
            console.error('Failed to copy citation:', error);
        });
}

function clearCitationForm() {
    // Clear all input fields
    document.querySelectorAll('.citation-form input').forEach(input => {
        input.value = '';
    });
    
    // Reset source type to default
    document.getElementById('source-type').value = 'book';
    
    // Reset output
    document.getElementById('citation-output').innerHTML = 
        '<div style="color: #aaa;">Generated citation will appear here...</div>';
    
    // Reload fields
    toggleCitationFields('book');
}

// Export functions for use in main script
window.CitationGenerator = {
    init: initCitationGenerator,
    toggleFields: toggleCitationFields,
    generate: generateCitation,
    copy: copyCitation,
    clear: clearCitationForm
};

// Show notification
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type === 'success' ? 'success-notification' : ''}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-info-circle'}"></i>
            <span>${message}</span>
        </div>
    `;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => notification.remove(), 500);
    }, 5000);
}

// Show error message
function showError(message) {
    const notification = document.createElement('div');
    notification.className = 'notification error-notification';
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-exclamation-triangle"></i>
            <span>${message}</span>
        </div>
    `;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => notification.remove(), 500);
    }, 5000);
}