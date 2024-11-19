const events = [
    'click',
    'mousedown',
    'mouseup',
    'mousemove',
    'keydown',
    'keyup',
    'input',
    'change',
    'drag',
    'dragstart',
    'dragend',
    'drop'
  ];


const currentURL = `${window.location.protocol}//${window.location.hostname}${window.location.port ? `:${window.location.port}` : ''}`;
const responseEvent = new EventSource(currentURL + '/strt/' + serverMessage + '.' + window.innerWidth + '.' + window.innerHeight);
responseEvent.onmessage = (e) => {
    console.log('message')
    const body = JSON.parse(e.data);
    const fixedHTML = fullReplace(body.content, body.url)
    document.open();
    document.write(fixedHTML);
    document.close();
    events.forEach(event => {
        document.addEventListener(event, (e) => {
            if(event != 'input' && event != 'keydown' && event != 'mousemove') {
                e.preventDefault()
                e.stopPropagation()
                e.target.focus()
            } else if(e?.key == 'Enter' || e?.key == 'Ctrl') {
                e.preventDefault()
                e.stopPropagation()
                e.target.focus()
            }
            sendEventToServer(e);
        });
    });
}

function fullReplace(input, originalURL) {
    const output = input
        .replace(/href="(?!http)([^"]+)"/g, `href="${originalURL}$1"`)
        .replace(/src="(?!http)([^"]+)"/g, `src="${originalURL}$1"`)
        .replace(/background-image\s*:\s*url\((?!http)([^)]+)\)/g, `background-image: url(${originalURL}$1)`)
        .replace(/(?:src|poster)="(?!http)([^"]+)"/g, (match, p1) => `src="${originalURL}${p1}"`)
        .replace(/url\((?!http)([^)]+)\)/g, `url(${originalURL}$1)`)
        .replace(/<link rel="shortcut icon" href="(?!http)([^"]+)"/g, (match, p1) => {
            if (p1.startsWith('/')) {
                return `<link rel="shortcut icon" href="${originalURL}${p1}"`;
            }
            return match;
        });

    return output;
}




(function() {
    const originalXHR = XMLHttpRequest.prototype.open;

    XMLHttpRequest.prototype.open = function(method, url) {
        const originalSend = this.send;

        this.send = function(body) {
            fetch(currentURL + '/prox', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    originalURL: url
                })
            })
            .then(response => response.text())
            .then(data => {
                Object.defineProperty(this, 'responseText', { value: data });
                Object.defineProperty(this, 'response', { value: data });
                Object.defineProperty(this, 'readyState', { value: 4 });
                Object.defineProperty(this, 'status', { value: 200 });

                if (typeof this.onreadystatechange === 'function') {
                    this.onreadystatechange();
                }
            })
            .catch(err => {
                console.error('Error in intercepted request:', err);
            });
        };

        return originalXHR.call(this, method, url);
    };
})();

  
  function sendEventToServer(event) {
    const eventData = {
      type: event.type,
      x: event.clientX,
      y: event.clientY,
      key: event.key || null,
      value: event.target.value || null,
      element: generateXPath(event?.target) || null,
    };
  
    fetch(currentURL + '/updt/' + serverMessage, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventData),
    });
  }
  
function generateXPath(element) {
    const paths = [];
    while (element.nodeType === Node.ELEMENT_NODE) {
        let siblingIndex = 1;
        let sibling = element.previousSibling;
        
        while (sibling) {
            if (sibling.nodeType === Node.ELEMENT_NODE && sibling.tagName === element.tagName) {
                siblingIndex++;
            }
            sibling = sibling.previousSibling;
        }

        const tagName = element.tagName.toLowerCase();
        const pathSegment = `${tagName}[${siblingIndex}]`;
        paths.unshift(pathSegment);
        element = element.parentNode;
    }

    return '/' + paths.join('/');
}
