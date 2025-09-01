// Extremely simple Hello World card for testing
console.log("Simple Hello World card loading...");

class SimpleHelloWorldCard extends HTMLElement {
  set hass(hass) {
    // Do nothing for now
  }

  setConfig(config) {
    // Do nothing for now
  }

  connectedCallback() {
    console.log("Simple Hello World card connected");
    this.innerHTML = '<div style="padding: 20px; background: white; border: 1px solid #ccc;"><h3>Simple Hello World Card</h3><p>If you see this, the card is working!</p></div>';
  }
}

// Try to define the element
try {
  customElements.define('simple-hello-world-card', SimpleHelloWorldCard);
  console.log("Simple Hello World card defined successfully");
} catch (error) {
  console.error("Error defining Simple Hello World card:", error);
}

// Register with Home Assistant
if (typeof window.customCards === 'undefined') {
  window.customCards = [];
}
window.customCards.push({
  type: 'simple-hello-world-card',
  name: 'Simple Hello World Card',
  description: 'A very simple test card'
});
console.log("Simple Hello World card registered with Home Assistant");

console.log("Simple Hello World card loaded");