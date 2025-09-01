"""Voice Streaming Integration for Home Assistant."""
import logging
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

DOMAIN = "voice_streaming"
_LOGGER = logging.getLogger(__name__)

async def async_setup(hass: HomeAssistant, config: dict):
    """Set up the Voice Streaming component."""
    hass.data[DOMAIN] = {}
    return True

async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry):
    """Set up Voice Streaming from a config entry."""
    
    # Initialize the voice streaming coordinator
    coordinator = VoiceStreamingCoordinator(hass, entry)
    await coordinator.async_setup()
    
    hass.data[DOMAIN][entry.entry_id] = coordinator
    
    return True

class VoiceStreamingCoordinator:
    """Coordinator for managing voice streaming connections."""
    
    def __init__(self, hass: HomeAssistant, entry: ConfigEntry):
        self.hass = hass
        self.entry = entry
        self.connections = {}
        
    async def async_setup(self):
        """Set up the coordinator."""
        # Register services
        self.hass.services.async_register(
            DOMAIN, 
            "start_recording", 
            self.start_recording
        )
        
        self.hass.services.async_register(
            DOMAIN, 
            "stop_recording", 
            self.stop_recording
        )
        
    async def start_recording(self, call):
        """Start voice recording service."""
        _LOGGER.info("Starting voice recording")
        self.hass.bus.async_fire("voice_streaming.recording_started")
        
    async def stop_recording(self, call):
        """Stop voice recording service."""
        _LOGGER.info("Stopping voice recording")
        self.hass.bus.async_fire("voice_streaming.recording_stopped")