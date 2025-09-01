// More standard Hello World test for Home Assistant custom panel
(function () {
  'use strict';

  class HelloWorldPanel extends HTMLElement {
    set hass(hass) {
      this._hass = hass;
      this.render();
    }

    setConfig(config) {
      this._config = config;
    }

    connectedCallback() {
      this.render();
    }

    render() {
      if (!this._hass) {
        return;
      }

      this.innerHTML = `
        <div style="padding: 20px; background: var(--ha-card-background, white); border-radius: 8px; box-shadow: var(--ha-card-box-shadow); margin: 20px;">
          <h2>Hello World from Custom Panel!</h2>
          <p>This is a simple test to verify the custom panel is working.</p>
          <p>If you can see this message, the custom panel system is working correctly.</p>
          <p>Current time: ${new Date().toLocaleString()}</p>
        </div>
      `;
    }
  }

  customElements.define('hello-world-panel', HelloWorldPanel);

  // Register with Home Assistant
  if (!window.HASS_HELLO_WORLD_PANEL) {
    window.HASS_HELLO_WORLD_PANEL = HelloWorldPanel;
  }

  // For module usage
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = HelloWorldPanel;
  }
})();