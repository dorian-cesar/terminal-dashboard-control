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
      bottom: 10px;
      z-index: 9999;
      display: none;
      justify-content: center;
      align-items: flex-end;
      pointer-events: none;
      -webkit-tap-highlight-color: transparent;
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial;
      padding: 0 10px;
      box-sizing: border-box;
    }
    
    :host([visible]) {
      display: flex !important;
      pointer-events: auto;
    }
    
    .vk-container {
      width: min(1100px, 100%);
      background: linear-gradient(180deg,var(--vk-bg), #fff);
      border-radius: var(--vk-radius);
      box-shadow: 
        0 -4px 20px rgba(0,0,0,0.15), 
        var(--vk-key-shadow);
      padding: 12px;
      margin: 0 auto;
      user-select: none;
      pointer-events: auto;
      max-height: 350px;
      overflow-y: auto;
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
      padding: 12px 8px;
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
      min-width: 0;
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
    
    /* 🔹 MEJORAS RESPONSIVE */
    @media(max-width: 900px){
      :host {
        bottom: 5px;
        padding: 0 5px;
      }
      
      .vk-container {
        padding: 10px;
        max-height: 320px;
      }
      
      button.key {
        font-size: 1rem;
        min-height: 44px;
        padding: 10px 6px;
      }
    }
    
    @media(max-width: 768px){
      .vk-container {
        max-height: 300px;
      }
      
      button.key {
        font-size: 0.95rem;
        min-height: 42px;
        padding: 8px 4px;
      }
      
      .key.space {
        grid-column: span 4;
      }
    }
    
    @media(max-width: 480px){
      :host {
        bottom: 2px;
        padding: 0 2px;
      }
      
      .vk-container {
        padding: 8px;
        max-height: 280px;
        border-radius: 10px 10px 0 0;
      }
      
      button.key {
        font-size: 0.9rem;
        min-height: 40px;
        padding: 6px 3px;
      }
      
      .vk-row {
        gap: 6px;
        margin-bottom: 6px;
      }
    }

    @media(max-width: 360px){
      .vk-container {
        max-height: 250px;
      }
      
      button.key {
        font-size: 0.85rem;
        min-height: 38px;
      }
      
      .key.space {
        grid-column: span 3;
      }
    }
  </style>

  <div class="vk-container" role="application" aria-label="Teclado virtual">
    <div class="vk-topbar">
      <div class="vk-title">Teclado — Español (Latinoamérica)</div>
    </div>
    <div class="vk-rows"></div>
  </div>
`;

class VirtualKeyboard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot.appendChild(vkTemplate.content.cloneNode(true));
    this.rowsHost = this.shadowRoot.querySelector(".vk-rows");
    this.shift = false;
    this.altGr = false;
    this.targetSelector = this.getAttribute("data-target") || null;
    this.layouts = this._createLayouts();
    this.isVisible = false;
  }

  connectedCallback() {
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
    
    // Ocultar inicialmente
    this.hide();
  }

  _createLayouts() {
    const base = [
      ["`","1","2","3","4","5","6","7","8","9","0","-","=","⌫"],
      ["q","w","e","r","t","y","u","i","o","p","[","]","\\\\"],
      ["a","s","d","f","g","h","j","k","l","ñ",";","'","Enter"],
      ["Shift","z","x","c","v","b","n","m",",",".","/","Shift"],
      ["@","Space","."]
    ];
    const shift = [
      ["~","!","@","#","$","%","^","&","*","(",")","_","+","⌫"],
      ["Q","W","E","R","T","Y","U","I","O","P","{","}","|"],
      ["A","S","D","F","G","H","J","K","L","Ñ",":","\"","Enter"],
      ["Shift","Z","X","C","V","B","N","M","<",">","?","Shift"],
      ["@","Space","."]
    ];
    const alt = [
      ["º","1","2","3","4","5","6","7","8","9","0","-","=","⌫"],
      ["q","w","e","r","t","y","u","i","o","p","[","]","\\\\"],
      ["á","é","í","ó","ú","ü","¿","¡","°","ç",";","'","Enter"],
      ["Shift","ß","ñ","œ","@","#","$","¢","€","£","/","Shift"],
      ["@","Space","."]
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
        
        // Aplicar estilos especiales
        if(key === "Enter") b.classList.add("primary");
        if(key === "Space") b.classList.add("space");
        if(["Shift", "⌫", "Enter"].includes(key)) b.classList.add("small");
        
        // Prevenir propagación en cada tecla
        b.addEventListener("mousedown", (e) => e.stopPropagation());
        b.addEventListener("touchstart", (e) => e.stopPropagation());
        
        div.appendChild(b);
      });
      this.rowsHost.appendChild(div);
    });
  }

  _onClick(e) {
    const key = e.composedPath().find(n=>n.dataset && n.dataset.key)?.dataset.key;
    if(!key) return;
    
    if(key === "Shift"){ 
      this.shift = !this.shift; 
      this._render(); 
      return; 
    }
    
    if(key === "AltGr"){ 
      this.altGr = !this.altGr; 
      this._render(); 
      return; 
    }
    
    if(key === "⌫") return this._send("Backspace");
    if(key === "Enter") return this._send("Enter");
    if(key === "Space") return this._send(" ");
    
    this._send(key);
  }

  _send(key) {
    const el = this.targetEl || document.activeElement;
    if(!el) return;
    
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    
    if(key === "Backspace") {
      if (start > 0) {
        el.value = el.value.slice(0, start - 1) + el.value.slice(end);
        this._setCaret(el, start - 1);
      }
    } else {
      el.value = el.value.slice(0, start) + key + el.value.slice(end);
      this._setCaret(el, start + key.length);
    }
    
    el.dispatchEvent(new Event("input", {bubbles: true}));
  }

  _setCaret(el, pos){ 
    try{ 
      el.setSelectionRange(pos, pos); 
      el.focus(); 
    } catch{} 
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