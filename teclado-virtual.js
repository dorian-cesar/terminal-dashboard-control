const vkTemplate = document.createElement("template");
vkTemplate.innerHTML = `
  <style>
    :host {
      --vk-bg: #f3f4f6;
      --vk-key-bg: #ffffff;
      --vk-key-border: rgba(0,0,0,0.08);
      --vk-key-shadow: 0 4px 8px rgba(0,0,0,0.06);
      --vk-accent: #0d6efd;
      --vk-radius: 12px;
      --vk-gap: 8px;
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 9999;
      display: none;
      justify-content: center;
      pointer-events: none;
      -webkit-tap-highlight-color: transparent;
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial;
    }
    
    :host([visible]) {
      display: flex !important;
      pointer-events: auto;
    }
    
    .vk-container {
      width: min(1100px, calc(100% - 20px));
      background: linear-gradient(180deg,var(--vk-bg), #fff);
      border-radius: var(--vk-radius) var(--vk-radius) 0 0;
      box-shadow: var(--vk-key-shadow);
      padding: 12px;
      margin: 0 auto;
      user-select: none;
      pointer-events: auto;
    }
    
    .vk-row { 
      display: grid; 
      gap: var(--vk-gap); 
      margin-bottom: 8px; 
    }
    
    button.key {
      background: var(--vk-key-bg);
      border: 1px solid var(--vk-key-border);
      border-radius: 10px;
      padding: 12px 10px;
      font-size: 1.05rem;
      min-height: 48px;
      box-shadow: 0 2px 0 rgba(0,0,0,0.02) inset;
      cursor: pointer;
      transition: transform 80ms ease, box-shadow 80ms ease, background 120ms ease;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: none;
      outline: none;
    }
    
    button.key:active { 
      transform: translateY(2px); 
    }
    
    .key.wide { grid-column: span 2; }
    .key.extra-wide { grid-column: span 3; }
    .key.space { grid-column: span 6; }
    .key.primary { background: var(--vk-accent); color: #fff; font-weight: 600; }
    
    .vk-topbar { 
      display: flex; 
      justify-content: space-between; 
      align-items: center; 
      margin-bottom: 6px; 
    }
    
    .small { font-size: 0.78rem; opacity: 0.85; }
    
    @media(max-width:900px){
      button.key{font-size:1rem;min-height:44px}
    }
    
    @media(max-width:480px){
      button.key{font-size:0.95rem;min-height:40px}
    }
  </style>

  <div class="vk-container" role="application" aria-label="Teclado virtual">
    <div class="vk-topbar">
      <div class="vk-title">Teclado — Español (Latinoamérica)</div>
      <div class="vk-controls">
        <button class="small key" data-action="toggle-mode">Modo</button>
        <button class="small key" data-action="hide">Cerrar ✕</button>
      </div>
    </div>
    <div class="vk-rows"></div>
  </div>
  <div aria-live="polite" class="vk-live" style="position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden"></div>
`;

class VirtualKeyboard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot.appendChild(vkTemplate.content.cloneNode(true));
    this.rowsHost = this.shadowRoot.querySelector(".vk-rows");
    this.live = this.shadowRoot.querySelector(".vk-live");
    this.shift = false;
    this.altGr = false;
    this.targetSelector = this.getAttribute("data-target") || null;
    this.mode = this.getAttribute("data-mode") || "dock";
    this.layouts = this._createLayouts();
    this.isVisible = false;
    this.ignoreNextClick = false;
  }

  connectedCallback() {
    // SOLUCIÓN: Usar setTimeout para manejar el orden de eventos
    document.addEventListener("focusin", (e) => this._onFocus(e));
    
    // Eventos del teclado - PREVENIR PROPAGACIÓN
    this.shadowRoot.addEventListener("click", (e) => {
      e.stopPropagation();
      this._onClick(e);
    });
    
    this.shadowRoot.addEventListener("mousedown", (e) => {
      e.stopPropagation();
    });
    
    this.shadowRoot.addEventListener("touchstart", (e) => {
      e.stopPropagation();
    }, { passive: false });
    
    this._render();
    
    // Botones de control
    this.shadowRoot.querySelector('[data-action="hide"]').onclick = (e) => {
      e.stopPropagation();
      this.hide();
    };
    
    this.shadowRoot.querySelector('[data-action="toggle-mode"]').onclick = (e) => {
      e.stopPropagation();
      this.mode = this.mode === "dock" ? "float" : "dock";
      this.live.textContent = `Modo ${this.mode}`;
    };
    
    // Ocultar inicialmente
    this.hide();
  }

  _createLayouts() {
    const base = [
      ["`","1","2","3","4","5","6","7","8","9","0","-","=","Backspace"],
      ["Tab","q","w","e","r","t","y","u","i","o","p","[","]","\\\\"],
      ["Caps","a","s","d","f","g","h","j","k","l","ñ",";","'","Enter"],
      ["Shift","z","x","c","v","b","n","m",",",".","/","Shift"],
      ["Ctrl","Win","Alt","Space","AltGr","Menu","Ctrl"]
    ];
    const shift = [
      ["~","!","@","#","$","%","^","&","*","(",")","_","+","Backspace"],
      ["Tab","Q","W","E","R","T","Y","U","I","O","P","{","}","|"],
      ["Caps","A","S","D","F","G","H","J","K","L","Ñ",":","\"","Enter"],
      ["Shift","Z","X","C","V","B","N","M","<",">","?","Shift"],
      ["Ctrl","Win","Alt","Space","AltGr","Menu","Ctrl"]
    ];
    const alt = [
      ["º","1","2","3","4","5","6","7","8","9","0","-","=","Backspace"],
      ["Tab","q","w","e","r","t","y","u","i","o","p","[","]","\\\\"],
      ["Caps","á","é","í","ó","ú","ü","¿","¡","°","ç",";","'","Enter"],
      ["Shift","ß","ñ","œ","@","#","$","¢","€","£","/","Shift"],
      ["Ctrl","Win","Alt","Space","AltGr","Menu","Ctrl"]
    ];
    return { base, shift, alt };
  }

  _render() {
    const layout = this.altGr ? this.layouts.alt : this.shift ? this.layouts.shift : this.layouts.base;
    this.rowsHost.innerHTML = "";
    layout.forEach(row => {
      const div = document.createElement("div");
      div.className = "vk-row";
      div.style.gridTemplateColumns = `repeat(${row.length},1fr)`;
      row.forEach(key => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "key";
        b.dataset.key = key;
        b.textContent = key;
        if(["Backspace","Enter","Shift","Tab","Caps","Space","AltGr","Ctrl","Win","Alt","Menu"].includes(key)) b.classList.add("small");
        if(key==="Enter") b.classList.add("primary");
        if(key==="Space") b.classList.add("space");
        
        // Prevenir propagación en cada tecla
        b.addEventListener("mousedown", (e) => e.stopPropagation());
        b.addEventListener("touchstart", (e) => e.stopPropagation());
        
        div.appendChild(b);
      });
      this.rowsHost.appendChild(div);
    });
  }

  _onFocus(e) {
    const el = e.target;
    if(el.matches("input[type=text],input[type=email],input[type=password],input[type=search],textarea")) {
      // SOLUCIÓN: Usar setTimeout para permitir que el click se procese primero
      setTimeout(() => {
        this.show(el);
      }, 10);
    } else if(this.mode === "dock" && !this.contains(e.target)) {
      this.hide();
    }
  }

  _onClick(e) {
    const key = e.composedPath().find(n=>n.dataset && n.dataset.key)?.dataset.key;
    if(!key) return;
    
    if(key==="Shift"){ 
      this.shift=!this.shift; 
      this._render(); 
      return; 
    }
    
    if(key==="AltGr"){ 
      this.altGr=!this.altGr; 
      this._render(); 
      return; 
    }
    
    if(key==="Backspace") return this._send("Backspace");
    if(key==="Enter") return this._send("Enter");
    if(key==="Space") return this._send(" ");
    
    this._send(key);
  }

  _send(key) {
    const el = this.targetEl || document.activeElement;
    if(!el) return;
    
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    
    if(key==="Backspace") {
      if (start > 0) {
        el.value = el.value.slice(0,start-1)+el.value.slice(end);
        this._setCaret(el,start-1);
      }
    } else {
      el.value = el.value.slice(0,start)+key+el.value.slice(end);
      this._setCaret(el,start+key.length);
    }
    
    el.dispatchEvent(new Event("input",{bubbles:true}));
  }

  _setCaret(el,pos){ 
    try{ 
      el.setSelectionRange(pos,pos); 
      el.focus(); 
    }catch{} 
  }

  show(target){ 
    this.targetEl = target; 
    this.isVisible = true;
    this.setAttribute("visible", "");
  }
  
  hide(){ 
    this.isVisible = false;
    this.removeAttribute("visible");
  }
}

customElements.define("virtual-keyboard", VirtualKeyboard);