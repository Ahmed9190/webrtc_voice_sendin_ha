// Simple Hello World card for testing
console.log("Hello World card loading...");

class HelloWorldCard extends HTMLElement {
  set hass(hass) {
    this._hass = hass;
    this.render();
  }

  setConfig(config) {
    this._config = config;
  }

  getCardSize() {
    return 3;
  }

  connectedCallback() {
    this.render();
  }

  render() {
    this.innerHTML = `
      <ha-card header="Hello World Card">
        <div class="card-content">
          <p>This is a simple test card to verify custom cards are working.</p>
          <p>If you can see this message, custom cards are working correctly.</p>
        </div>
      </ha-card>
    `;
  }
}

customElements.define('hello-world-card', HelloWorldCard);

// Register with Home Assistant
window.customCards = window.customCards || [];
window.customCards.push({
  type: 'hello-world-card',
  name: 'Hello World Card',
  description: 'A simple hello world card for testing'
});

console.log("Hello World card registered");