// Minimal custom panel for testing
console.log("Minimal custom panel loading...");

// Define a simple custom element
class MinimalPanel extends HTMLElement {
  connectedCallback() {
    console.log("Minimal panel connected");
    this.innerHTML = `
      <div style="padding: 20px; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <h2>Minimal Custom Panel</h2>
        <p>If you can see this message, the custom panel system is working!</p>
        <p>Current time: ${new Date().toLocaleString()}</p>
      </div>
    `;
  }
}

// Define the custom element
customElements.define('minimal-panel', MinimalPanel);

// For Home Assistant panel integration
window.customPanel = () => {
  console.log("Creating minimal panel");
  return document.createElement('minimal-panel');
};

console.log("Minimal custom panel registered");