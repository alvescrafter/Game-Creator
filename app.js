/* ═══════════════════════════════════════════════
   Game Creator — Prompt Orchestrator
   app.js — Core Logic
   ═══════════════════════════════════════════════ */

(function () {
  'use strict';

  // ── Storage Keys (versioned) ──
  const KEYS = {
    STATE: 'gameCreator.state.v1',
    API: 'gameCreator.api.v1',
    HISTORY: 'gameCreator.history.v1',
  };

  const MAX_HISTORY = 50;

  // ── Default State ──
  // Pre-selected defaults ensure the mandatory game structure is always satisfied
  // even if the user never touches the sidebar modules.
  const DEFAULT_STATE = {
    outputMode: 'single', // 'single' or 'multi'
    coreIdentity: {
      genre: 'Arcade Collector',
      theme: '',
      tone: 50,
    },
    mechanics: {
      tags: ['Health Bar', 'Collectibles'],
      rules: '',
      difficulty: '',
    },
    visuals: {
      artStyle: '',
      colorPrimary: '#6c5ce7',
      colorSecondary: '#00cec9',
      colorBg: '#0a0a1a',
      vfx: '',
    },
    gameMenu: {
      menuType: 'Complete Game Flow',
      menuOptions: ['Start Game'],
      hudElements: ['Score', 'Health Bar', 'Lives'],
      gameActions: ['Pause/Resume (ESC)', 'Back to Menu'],
      gameOverType: 'Score Summary + Retry',
      escBehavior: 'Pause Game + Show Menu',
    },
    audio: {
      musicMood: '',
      sfx: '',
    },
  };

  // ── Background Tech Stack Defaults (not shown in UI) ──
  const TECH_DEFAULTS = {
    framework: 'Vanilla JS/Canvas',
    singleFile: true,
    assetHandling: 'Use placeholder colored rectangles and simple shapes',
    maxTokens: 100000,
  };

  const FALLBACK_GENRE = 'Arcade Collector';
  const REQUIRED_MENU_OPTIONS = ['Start Game'];
  const REQUIRED_GAME_ACTIONS = ['Pause/Resume (ESC)', 'Back to Menu'];
  const REQUIRED_GAME_OVER_ACTIONS = ['Play Again / Retry'];
  const SAFE_OPTIONAL_MENU_OPTIONS = ['Settings', 'How to Play', 'High Scores', 'Credits'];
  const SAFE_OPTIONAL_GAME_ACTIONS = ['Restart Game', 'Restart Level', 'Mute/Unmute'];

  const MECHANIC_REQUIREMENTS = {
    'Double Jump': 'If jumping exists, add a double-jump counter that resets only after landing on solid ground.',
    'Inventory System': 'Represent inventory as a small array/list in state; allow at least one pickup and one visible inventory HUD entry.',
    'Health Bar': 'Track player health numerically, draw a readable health bar or HP text, and trigger GAME_OVER at zero.',
    Gravity: 'Apply gravity every update, clamp falling speed, and resolve floor/platform collisions so the player cannot fall forever.',
    Permadeath: 'When HP/lives reach zero, transition to GAME_OVER and reset only from the Retry/Play Again button.',
    'Leveling Up': 'Track XP/progress, show level in the HUD, and increase at least one player stat or reward on level-up.',
    Crafting: 'Include two collectible ingredients and one simple recipe that creates a useful item or score bonus.',
    Stealth: 'Add enemy vision or patrol awareness and a visible alert/hidden state that affects player risk.',
    'Procedural Generation': 'Generate the level/layout from deterministic arrays or simple random placement during resetGame().',
    Physics: 'Use velocity, acceleration/friction, and collision response rather than teleport-style movement.',
    'Dialogue System': 'Show dialogue in an HTML overlay or canvas text box, advanced by click/Space/Enter.',
    Collectibles: 'Place collectible objects, detect overlap with the player, remove collected items, and increase score/progress.',
  };

  const VISUAL_STYLE_REQUIREMENTS = {
    'Pixel Art': 'Use crisp blocky rectangles, disabled image smoothing, and a limited palette.',
    'Minimalist Vector': 'Use clean geometric shapes, clear silhouettes, and restrained UI.',
    ASCII: 'Use monospaced text motifs only as decoration or labels; keep the controllable player visibly drawn on canvas.',
    'Low-Poly 2D': 'Use flat 2D low-poly facets on canvas; do not use WebGL, Three.js, or external libraries.',
    'Low-Poly 3D': 'Interpret as flat 2D low-poly facets on canvas; do not use WebGL, Three.js, or external libraries.',
    'Hand-drawn': 'Use imperfect strokes, sketch-like outlines, and organic shape variation.',
    'Flat Design': 'Use flat shapes, solid colors, and strong contrast without asset dependencies.',
    'Retro CRT': 'Add subtle scanlines/vignette CSS and chunky arcade colors while keeping text readable.',
    'Neon Glow': 'Use bright strokes/shadows on dark backgrounds while preserving gameplay clarity.',
  };

  // ── Genre-Specific Implementation Requirements ──
  // Injected into the prompt to ensure every genre gets its mandatory gameplay elements
  const GENRE_REQUIREMENTS = {
    Shooter: [
      'A player ship/character positioned at the bottom of the canvas, drawn as a distinct colored shape (min 24x24px).',
      'The player moves LEFT/RIGHT with Arrow keys or A/D, and fires bullets with SPACEBAR.',
      'Bullets are drawn as small rectangles moving upward from the player position.',
      'Enemies spawn at the top of the canvas and move downward toward the player.',
      'Collision detection between bullets and enemies (bullet-enemy overlap removes both and adds score).',
      'Collision detection between enemies and the player (reduces health/lives).',
      'Score increases for each enemy destroyed. Display score in the HUD.',
      'Player has health or lives displayed in the HUD. Game over when health/lives reach zero.',
    ],
    Platformer: [
      'A player character drawn as a distinct colored shape (min 24x24px) that can move LEFT/RIGHT and JUMP.',
      'Arrow keys or A/D for left/right movement, SPACEBAR or W or Up Arrow for jumping.',
      'Gravity constantly pulls the player downward when not on a platform.',
      'Multiple platforms drawn as rectangles with collision detection (player lands on top of them).',
      'Collectibles (coins/items) drawn as small shapes that the player can pick up by overlapping.',
      'Hazards (spikes/lava) that damage or kill the player on contact.',
      'A level goal (flag/door) that advances to the next level or triggers a win condition.',
      'Score or collectible count displayed in the HUD.',
    ],
    Puzzle: [
      'A grid or pattern-based play area where the player interacts with elements.',
      'Click with mouse or use arrow keys to manipulate puzzle pieces/tiles.',
      'A clear win condition (match colors, clear board, reach target, solve pattern).',
      'Visual feedback when pieces move, match, or are placed correctly.',
      'A move counter or score displayed in the HUD.',
      'The puzzle must be solvable and have at least one valid solution.',
    ],
    RPG: [
      'A player character with stats: HP (health), Level, and XP (experience points) displayed in the HUD.',
      'Player moves on a map with Arrow keys or WASD.',
      'An enemy or combat system: enemies have HP, player attacks reduce enemy HP, enemy attacks reduce player HP.',
      'Defeating enemies grants XP; reaching XP thresholds levels up the player (increases max HP / attack).',
      'An inventory system: items can be picked up and used (potions heal HP, etc.).',
      'At least one NPC with a dialogue system (text box with messages).',
      'A win condition (defeat a boss, reach a location, collect an item).',
    ],
    Idle: [
      'A primary resource (e.g. gold, cookies, energy) with a large number display in the HUD.',
      'A clickable button or area that generates the primary resource on each click.',
      'Auto-generation: at least one passive producer that generates resources per second.',
      'An upgrade system: spend resources to increase click value or auto-generation rate.',
      'Upgrades have scaling cost (each purchase costs more than the last).',
      'Numbers should be formatted with suffixes (K, M, B) for large values.',
    ],
    Racing: [
      'A vehicle the player controls, drawn as a distinct colored shape.',
      'Arrow keys or A/D for steering LEFT/RIGHT, W/Up to accelerate, S/Down to brake.',
      'A scrolling track/road that moves to create the illusion of forward motion.',
      'Obstacles on the track that the player must avoid (collision slows or damages the vehicle).',
      'Speed displayed in the HUD. A lap timer or countdown timer displayed in the HUD.',
      'Collision with obstacles has a penalty (slow down, lose health, or time penalty).',
    ],
    Strategy: [
      'A grid-based map where units and buildings are placed.',
      'Unit selection: click to select a unit, click again to move/command it.',
      'Resource management: at least one resource (gold/energy/food) that is produced over time.',
      'Unit production: spend resources to create new units from a building.',
      'An AI opponent that also produces units and attacks the player.',
      'A win condition (destroy enemy base, reach resource target, eliminate all enemy units).',
    ],
    Roguelike: [
      'A procedurally generated dungeon: rooms connected by corridors, drawn on a tile grid.',
      'Player character moves with Arrow keys on the grid (one tile per press).',
      'Turn-based: enemies move after the player moves.',
      'Player stats: HP, attack power, and level displayed in the HUD.',
      'Items: potions (heal HP), weapons (increase attack) that can be picked up.',
      'Enemies with HP that the player fights by moving into them.',
      'Permadeath: when HP reaches zero, the game is over with no respawn.',
      'Stairs/exit to descend to the next level (regenerates a new dungeon).',
    ],
    Simulation: [
      'A managed system with at least 2 resource types (e.g. money, population, energy).',
      'Time progression: the simulation advances on a timer (ticks every second or via requestAnimationFrame).',
      'Building/placing mechanic: click to place buildings or assign resources.',
      'Cause and effect: buildings produce resources, resources enable more buildings.',
      'Stats display: current resources, population, or other metrics shown in the HUD.',
      'Random events or challenges that affect the system (e.g. random income, random cost).',
    ],
    'Visual Novel': [
      'A story text box at the bottom of the screen displaying dialogue/narration.',
      'Character portraits or scene backgrounds drawn on canvas (colored shapes are fine).',
      'Dialogue advances on click or SPACEBAR/ENTER press.',
      'At least 2 branching choices presented as clickable buttons that change the story path.',
      'Scene changes: background color or portrait changes when the scene shifts.',
      'Character names displayed above the dialogue text.',
    ],
    [FALLBACK_GENRE]: [
      'A player character that moves around the canvas with Arrow keys or WASD.',
      'Collectible items that spawn in reachable positions and increase score when collected.',
      'Hazards or enemies that move, patrol, or spawn over time and damage the player on collision.',
      'A health/lives value displayed in the HUD, with GAME_OVER when it reaches zero.',
      'A simple progression curve: spawn rate, hazard speed, or score target increases during play.',
      'A clear win or milestone condition such as reaching a score target, surviving a timer, or clearing a wave.',
    ],
  };

  // ── Genre-Based Sidebar Auto-Configuration ──
  // When a genre is selected, these defaults are applied to the sidebar modules.
  // The user can still toggle/override individual tags afterwards.
  const GENRE_DEFAULTS = {
    [FALLBACK_GENRE]: {
      mechanics: ['Health Bar', 'Collectibles'],
      hudElements: ['Score', 'Health Bar', 'Lives'],
      gameActions: ['Pause/Resume (ESC)', 'Back to Menu'],
      menuOptions: ['Start Game', 'How to Play'],
    },
    Shooter: {
      mechanics: ['Health Bar', 'Collectibles'],
      hudElements: ['Score', 'Health Bar', 'Lives'],
      gameActions: ['Pause/Resume (ESC)', 'Back to Menu'],
      menuOptions: ['Start Game'],
    },
    Platformer: {
      mechanics: ['Double Jump', 'Gravity', 'Collectibles'],
      hudElements: ['Score', 'Lives', 'Level Indicator'],
      gameActions: ['Pause/Resume (ESC)', 'Back to Menu'],
      menuOptions: ['Start Game'],
    },
    Puzzle: {
      mechanics: [],
      hudElements: ['Score', 'Timer'],
      gameActions: ['Pause/Resume (ESC)', 'Back to Menu'],
      menuOptions: ['Start Game'],
    },
    RPG: {
      mechanics: ['Inventory System', 'Health Bar', 'Leveling Up', 'Dialogue System'],
      hudElements: ['Health Bar', 'Level Indicator', 'Inventory Bar'],
      gameActions: ['Pause/Resume (ESC)', 'Back to Menu'],
      menuOptions: ['Start Game', 'How to Play'],
    },
    Idle: {
      mechanics: ['Leveling Up'],
      hudElements: ['Score'],
      gameActions: ['Pause/Resume (ESC)', 'Back to Menu'],
      menuOptions: ['Start Game'],
    },
    Racing: {
      mechanics: ['Physics'],
      hudElements: ['Timer', 'Score'],
      gameActions: ['Pause/Resume (ESC)', 'Back to Menu'],
      menuOptions: ['Start Game'],
    },
    Strategy: {
      mechanics: ['Inventory System'],
      hudElements: ['Score', 'Level Indicator'],
      gameActions: ['Pause/Resume (ESC)', 'Back to Menu'],
      menuOptions: ['Start Game', 'How to Play'],
    },
    Roguelike: {
      mechanics: ['Permadeath', 'Procedural Generation', 'Inventory System', 'Leveling Up'],
      hudElements: ['Health Bar', 'Level Indicator', 'Inventory Bar'],
      gameActions: ['Pause/Resume (ESC)', 'Back to Menu'],
      menuOptions: ['Start Game'],
    },
    Simulation: {
      mechanics: ['Leveling Up'],
      hudElements: ['Score', 'Level Indicator'],
      gameActions: ['Pause/Resume (ESC)', 'Back to Menu'],
      menuOptions: ['Start Game'],
    },
    'Visual Novel': {
      mechanics: ['Dialogue System'],
      hudElements: [],
      gameActions: ['Pause/Resume (ESC)', 'Back to Menu'],
      menuOptions: ['Start Game'],
    },
  };

  const DEFAULT_API = {
    baseUrl: 'https://api.openai.com/v1',
    key: '',
    model: 'gpt-4o',
    temperature: 0.7,
    provider: 'openai',
  };

  // ── Module enabled state (all on by default) ──
  const DEFAULT_MODULE_ENABLED = {
    coreIdentity: true,
    mechanics: true,
    visuals: true,
    gameMenu: true,
    audio: false,
  };

  // ── Provider Presets ──
  const PROVIDER_PRESETS = {
    openai: {
      baseUrl: 'https://api.openai.com/v1',
      models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo', 'o1-preview', 'o1-mini', 'o3-mini'],
      defaultModel: 'gpt-4o',
      needsKey: true,
    },
    gemini: {
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
      models: ['gemini-2.5-pro-preview-03-25', 'gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-pro', 'gemini-1.5-flash'],
      defaultModel: 'gemini-2.0-flash',
      needsKey: true,
    },
    claude: {
      baseUrl: 'https://api.anthropic.com/v1',
      models: ['claude-sonnet-4-20250514', 'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
      defaultModel: 'claude-sonnet-4-20250514',
      needsKey: true,
    },
    ollama: {
      baseUrl: 'http://localhost:11434/v1',
      models: ['llama3.2', 'llama3.1', 'llama3', 'mistral', 'codellama', 'gemma2', 'phi3', 'qwen2', 'deepseek-coder-v2', 'mixtral'],
      defaultModel: 'llama3.2',
      needsKey: false,
    },
    lmstudio: {
      baseUrl: 'http://localhost:1234/v1',
      models: [], // Populated dynamically from server
      defaultModel: '',
      needsKey: false,
    },
    custom: {
      baseUrl: '',
      models: [],
      defaultModel: '',
      needsKey: true,
    },
  };

  // ── App State ──
  let state = deepClone(DEFAULT_STATE);
  let apiSettings = deepClone(DEFAULT_API);
  let moduleEnabled = deepClone(DEFAULT_MODULE_ENABLED);
  let conversationHistory = []; // for refine feature
  let lastGeneratedCode = '';
  let lastGeneratedFiles = null; // array of { path, content } for multi-file mode
  let isGenerating = false;
  let promptLocked = true; // prompt is locked by default
  let customPromptText = ''; // stores manually edited prompt when unlocked

  // ═══════════════════════════════════════════════
  // UTILITY FUNCTIONS
  // ═══════════════════════════════════════════════

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function uid() {
    try { return crypto.randomUUID(); }
    catch { return 'id_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  }

  function setNestedValue(obj, path, value) {
    const keys = path.split('.');
    let current = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) current[keys[i]] = {};
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
  }

  function getNestedValue(obj, path) {
    return path.split('.').reduce((o, k) => (o || {})[k], obj);
  }

  function formatTimestamp(ts) {
    const d = new Date(ts);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // ═══════════════════════════════════════════════
  // PERSISTENCE (localStorage)
  // ═══════════════════════════════════════════════

  function saveState() {
    try {
      localStorage.setItem(KEYS.STATE, JSON.stringify({ state, moduleEnabled, promptLocked, customPromptText }));
    } catch (e) {
      console.warn('Failed to save state:', e);
    }
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(KEYS.STATE);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.state) state = { ...deepClone(DEFAULT_STATE), ...parsed.state };
        if (parsed.moduleEnabled) moduleEnabled = { ...deepClone(DEFAULT_MODULE_ENABLED), ...parsed.moduleEnabled };
        if (typeof parsed.promptLocked === 'boolean') promptLocked = parsed.promptLocked;
        if (typeof parsed.customPromptText === 'string') customPromptText = parsed.customPromptText;
      }
    } catch (e) {
      console.warn('Failed to load state:', e);
    }
    normalizeStateForReliability();
  }

  function saveApiSettings() {
    try {
      localStorage.setItem(KEYS.API, JSON.stringify(apiSettings));
    } catch (e) {
      console.warn('Failed to save API settings:', e);
    }
  }

  function loadApiSettings() {
    try {
      const raw = localStorage.getItem(KEYS.API);
      if (raw) {
        apiSettings = { ...deepClone(DEFAULT_API), ...JSON.parse(raw) };
      }
    } catch (e) {
      console.warn('Failed to load API settings:', e);
    }
  }

  function readHistory() {
    try { return JSON.parse(localStorage.getItem(KEYS.HISTORY) || '[]'); }
    catch { return []; }
  }

  function writeHistory(list) {
    // Prune to MAX_HISTORY
    if (list.length > MAX_HISTORY) list = list.slice(0, MAX_HISTORY);
    try { localStorage.setItem(KEYS.HISTORY, JSON.stringify(list)); }
    catch (e) { console.warn('Failed to save history:', e); }
  }

  // ═══════════════════════════════════════════════
  // TOAST NOTIFICATIONS
  // ═══════════════════════════════════════════════

  function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  // ═══════════════════════════════════════════════
  // LOADING OVERLAY
  // ═══════════════════════════════════════════════

  function showLoading(text = 'Generating your game...') {
    document.getElementById('loading-text').textContent = text;
    document.getElementById('loading-overlay').classList.remove('hidden');
  }

  function hideLoading() {
    document.getElementById('loading-overlay').classList.add('hidden');
  }

  function uniqueList(items) {
    return [...new Set((items || []).filter(Boolean))];
  }

  function getGenerationPlan(enabled = {}) {
    const selectedGenre = state.coreIdentity.genre;
    const genre = selectedGenre || FALLBACK_GENRE;
    const selectedMenuType = state.gameMenu.menuType || DEFAULT_STATE.gameMenu.menuType;
    const selectedEscBehavior = state.gameMenu.escBehavior || DEFAULT_STATE.gameMenu.escBehavior;
    const selectedGameOverType = state.gameMenu.gameOverType || DEFAULT_STATE.gameMenu.gameOverType;
    const requestedMenuOptions = state.gameMenu.menuOptions || [];
    const requestedGameActions = state.gameMenu.gameActions || [];
    const unsafeMenuOptions = requestedMenuOptions.filter(option => (
      !REQUIRED_MENU_OPTIONS.includes(option) && !SAFE_OPTIONAL_MENU_OPTIONS.includes(option)
    ));
    const unsafeGameActions = requestedGameActions.filter(action => (
      !REQUIRED_GAME_ACTIONS.includes(action) && !SAFE_OPTIONAL_GAME_ACTIONS.includes(action)
    ));

    const menuOptions = uniqueList([
      ...REQUIRED_MENU_OPTIONS,
      ...requestedMenuOptions.filter(option => SAFE_OPTIONAL_MENU_OPTIONS.includes(option)),
    ]);

    const hudElements = uniqueList([
      'Score',
      ...(state.gameMenu.hudElements || []),
    ]);

    const gameActions = uniqueList([
      ...REQUIRED_GAME_ACTIONS,
      ...requestedGameActions.filter(action => SAFE_OPTIONAL_GAME_ACTIONS.includes(action)),
      ...REQUIRED_GAME_OVER_ACTIONS,
    ]);

    const notes = [];

    if (!selectedGenre) {
      notes.push(`No genre selected: generate a compact ${FALLBACK_GENRE} game with movement, collectibles, hazards, scoring, and a game-over condition.`);
    }

    if (!enabled.gameMenu) {
      notes.push('Game Menu module is disabled, but the mandatory Title, Pause, and Game Over screens still apply.');
    }

    if (selectedMenuType === 'Title Screen Only') {
      notes.push('Menu Type "Title Screen Only" means the title is the only main menu; still include Pause and Game Over overlays.');
    } else if (selectedMenuType === 'Minimal Overlay') {
      notes.push('Menu Type "Minimal Overlay" means sparse styling; it must not remove required buttons or state transitions.');
    } else if (selectedMenuType === 'Compact Full Flow') {
      notes.push('Compact Full Flow means simple styling; it must still include Title, Pause, and Game Over screens.');
    }

    if (selectedEscBehavior && selectedEscBehavior !== 'Pause Game + Show Menu') {
      notes.push(`ESC behavior "${selectedEscBehavior}" is normalized: ESC pauses and shows the Pause Menu; Back to Menu handles returning to title.`);
    }

    if (!(state.gameMenu.menuOptions || []).includes('Start Game')) {
      notes.push('Start Game is required even if it is not selected in Menu Options.');
    }

    if (!(state.gameMenu.gameActions || []).includes('Pause/Resume (ESC)')) {
      notes.push('Pause/Resume (ESC) is required even if it is not selected in Standard Game Actions.');
    }

    if (!(state.gameMenu.gameActions || []).includes('Back to Menu')) {
      notes.push('Back to Menu is required even if it is not selected in Standard Game Actions.');
    }

    if (selectedGameOverType === 'Return to Menu') {
      notes.push('Game Over may include Return to Menu, but it must also include Play Again / Retry.');
    }

    if (unsafeMenuOptions.length > 0) {
      notes.push(`Ignored fragile menu option(s) for reliability: ${unsafeMenuOptions.join(', ')}.`);
    }

    if (unsafeGameActions.length > 0) {
      notes.push(`Ignored fragile game action(s) for reliability: ${unsafeGameActions.join(', ')}.`);
    }

    return {
      genre,
      selectedGenre,
      menuType: selectedMenuType,
      menuOptions,
      hudElements,
      gameActions,
      gameOverType: selectedGameOverType,
      escBehavior: 'Pause Game + Show Menu',
      requestedEscBehavior: selectedEscBehavior,
      notes,
    };
  }

  // ═══════════════════════════════════════════════
  // PROMPT ASSEMBLER
  // ═══════════════════════════════════════════════

  function normalizeStateForReliability() {
    state = {
      ...deepClone(DEFAULT_STATE),
      ...state,
      coreIdentity: { ...deepClone(DEFAULT_STATE.coreIdentity), ...(state.coreIdentity || {}) },
      mechanics: { ...deepClone(DEFAULT_STATE.mechanics), ...(state.mechanics || {}) },
      visuals: { ...deepClone(DEFAULT_STATE.visuals), ...(state.visuals || {}) },
      gameMenu: { ...deepClone(DEFAULT_STATE.gameMenu), ...(state.gameMenu || {}) },
      audio: { ...deepClone(DEFAULT_STATE.audio), ...(state.audio || {}) },
    };

    if (!state.coreIdentity.genre) state.coreIdentity.genre = FALLBACK_GENRE;
    if (state.visuals.artStyle === 'Low-Poly 3D') state.visuals.artStyle = 'Low-Poly 2D';

    const menuTypeMap = {
      'Title Screen + Pause Menu': 'Complete Game Flow',
      'Title Screen Only': 'Complete Game Flow',
      'Minimal Overlay': 'Compact Full Flow',
      'No Menu': 'Complete Game Flow',
    };
    state.gameMenu.menuType = menuTypeMap[state.gameMenu.menuType] || state.gameMenu.menuType || DEFAULT_STATE.gameMenu.menuType;

    const gameOverMap = {
      'Game Over Animation': 'Game Over Animation + Retry',
      'Return to Menu': 'Score Summary + Retry',
    };
    state.gameMenu.gameOverType = gameOverMap[state.gameMenu.gameOverType] || state.gameMenu.gameOverType || DEFAULT_STATE.gameMenu.gameOverType;
    state.gameMenu.escBehavior = 'Pause Game + Show Menu';

    state.gameMenu.menuOptions = uniqueList([
      ...REQUIRED_MENU_OPTIONS,
      ...(state.gameMenu.menuOptions || []).filter(option => SAFE_OPTIONAL_MENU_OPTIONS.includes(option)),
    ]);

    const mappedActions = (state.gameMenu.gameActions || []).map(action => (
      action === 'Restart Level' ? 'Restart Game' : action
    ));
    state.gameMenu.gameActions = uniqueList([
      ...REQUIRED_GAME_ACTIONS,
      ...mappedActions.filter(action => SAFE_OPTIONAL_GAME_ACTIONS.includes(action)),
    ]);

    if (!state.gameMenu.hudElements || state.gameMenu.hudElements.length === 0) {
      state.gameMenu.hudElements = [...DEFAULT_STATE.gameMenu.hudElements];
    } else if (!state.gameMenu.hudElements.includes('Score')) {
      state.gameMenu.hudElements = uniqueList(['Score', ...state.gameMenu.hudElements]);
    }

    if (state.coreIdentity.genre === FALLBACK_GENRE && (!state.mechanics.tags || state.mechanics.tags.length === 0)) {
      state.mechanics.tags = [...DEFAULT_STATE.mechanics.tags];
    }

    if (moduleEnabled.audio && !state.audio.musicMood && !state.audio.sfx) {
      moduleEnabled.audio = false;
    }
  }

  function assemblePrompt() {
    const enabled = {};

    // Check which modules are enabled
    document.querySelectorAll('.module-toggle').forEach(cb => {
      enabled[cb.dataset.moduleKey] = cb.checked;
    });

    const plan = getGenerationPlan(enabled);

    // ═════════════════════════════════════════════
    // SYSTEM PROMPT — Prescriptive, non-negotiable rules
    // ═════════════════════════════════════════════
    const isMultiFile = state.outputMode === 'multi';
    const maxTokens = getEffectiveMaxTokens();

    let systemPrompt = isMultiFile
      ? `You are an expert HTML5 Game Developer proficient in Vanilla JS and HTML5 Canvas. You generate complete, fully playable games as separate files (index.html, style.css, game.js).`
      : `You are an expert HTML5 Game Developer proficient in Vanilla JS and HTML5 Canvas. You generate complete, fully playable games in a single HTML file.`;

    // ── ABSOLUTE RULES ──
    systemPrompt += '\n\n═══ ABSOLUTE RULES (NON-NEGOTIABLE) ═══';
    if (isMultiFile) {
      systemPrompt += '\n1. Deliver the game as SEPARATE FILES: index.html, style.css, and game.js. The index.html must link to style.css via <link rel="stylesheet" href="style.css"> and to game.js via <script src="game.js"></script>. All CSS goes in style.css, all JavaScript goes in game.js, and index.html contains only the HTML structure.';
      systemPrompt += '\n2. Use HTML5 <canvas> for all game rendering. Get the 2D context with getContext("2d").';
      systemPrompt += '\n3. There is NO token limit. Make the game as detailed and feature-rich as you want. Split complex logic across the files as needed.';
      systemPrompt += '\n4. Use placeholder colored rectangles and simple shapes for all graphics — no image assets needed.';
      systemPrompt += '\n5. The game must be immediately playable with no setup, no loading screens, no external dependencies.';
      systemPrompt += '\n6. Output your response as a JSON object with this exact structure: {"files": [{"path": "index.html", "content": "..."}, {"path": "style.css", "content": "..."}, {"path": "game.js", "content": "..."}]}. Do NOT wrap the JSON in markdown code fences. Output raw JSON only.';
    } else {
      systemPrompt += '\n1. Deliver the ENTIRE game in a SINGLE HTML file — all HTML, CSS, and JavaScript inline. No external files, no external scripts, no CDN links.';
      systemPrompt += '\n2. Use HTML5 <canvas> for all game rendering. Get the 2D context with getContext("2d").';
      systemPrompt += `\n3. The entire game code MUST be below ${maxTokens.toLocaleString()} tokens. Keep it concise but fully functional.`;
      systemPrompt += '\n4. Use placeholder colored rectangles and simple shapes for all graphics — no image assets needed.';
      systemPrompt += '\n5. The game must be immediately playable with no setup, no loading screens, no external dependencies.';
    }

    // Playability guardrails keep sidebar choices from weakening the required game structure.
    systemPrompt += '\n\nCORE PLAYABILITY CONTRACT (ALWAYS ACTIVE)';
    systemPrompt += '\n- Sidebar options are additive preferences. They must NEVER remove the mandatory Title Screen, Pause Menu, Game Over screen, controls, HUD, player, game loop, or reset flow.';
    systemPrompt += '\n- If any sidebar option conflicts with this contract, satisfy the contract first and interpret the option as a styling or secondary-flow preference.';
    systemPrompt += '\n- The game must include a clear objective, a score/progress value that can change, at least one failure or completion condition, and a way to restart without reloading the page.';
    systemPrompt += '\n- Optional buttons such as Settings, How to Play, High Scores, Credits, Restart, and Mute must be lightweight in-game UI actions. Do not use browser-only behavior like window.close(), external pages, or server storage.';
    systemPrompt += '\n- If a requested mechanic is not natural for the genre, adapt it into a small compatible variant instead of letting it replace the core genre loop.';
    systemPrompt += '\n- If no genre is provided, create a compact arcade collector/dodger game with movement, collectibles, hazards, score, lives/health, and game over.';

    // ── MANDATORY PLAYER ENTITY ──
    systemPrompt += '\n\n═══ MANDATORY PLAYER ENTITY ═══';
    systemPrompt += '\nEvery game MUST have a visible, controllable player character:';
    systemPrompt += '\n- The player is drawn as a distinct colored shape (minimum 24x24 pixels) that is clearly visible against the background.';
    systemPrompt += '\n- The player MUST respond to keyboard input in real time — movement must feel immediate and smooth.';
    systemPrompt += '\n- The player MUST be drawn every frame during gameplay (in the render/update loop).';
    systemPrompt += '\n- The player position MUST be stored in variables (x, y) and updated based on input.';
    systemPrompt += '\n- The player MUST be constrained to the canvas boundaries (cannot move off-screen).';

    // ── MANDATORY CONTROLS ──
    systemPrompt += '\n\n═══ MANDATORY CONTROLS ═══';
    systemPrompt += '\nEvery game MUST implement keyboard controls using event listeners:';
    systemPrompt += '\n- Use Arrow Keys and/or WASD for movement (left, right, up, down).';
    systemPrompt += '\n- Use SPACEBAR for the primary action (jump, shoot, interact, etc.).';
    systemPrompt += '\n- Track key states with a keys object: listen for keydown and keyup events, store true/false per key.';
    systemPrompt += '\n- Read key states inside the update() function for smooth, continuous movement (do NOT move on keydown event alone).';
    systemPrompt += '\n- Display on-screen control instructions on the Title Screen or during gameplay (e.g. "Arrow Keys to Move, SPACE to Shoot").';
    systemPrompt += '\n- Use e.preventDefault() for arrow keys and spacebar to prevent page scrolling.';

    // ── MANDATORY GAME LOOP ──
    systemPrompt += '\n\n═══ MANDATORY GAME LOOP ═══';
    systemPrompt += '\nEvery game MUST have a proper game loop:';
    systemPrompt += '\n- Use requestAnimationFrame for the main loop.';
    systemPrompt += '\n- Separate logic into update() (game state, movement, collisions) and render() (drawing to canvas) functions.';
    systemPrompt += '\n- Call update() then render() each frame inside the requestAnimationFrame callback.';
    systemPrompt += '\n- Only run the game loop when the game state is PLAYING. Stop or pause the loop when in TITLE, PAUSED, or GAME_OVER states.';
    systemPrompt += '\n- Use a delta time or fixed timestep so the game runs at a consistent speed.';

    // ── MANDATORY BUTTON IMPLEMENTATION ──
    systemPrompt += '\n\n═══ MANDATORY BUTTON IMPLEMENTATION ═══';
    systemPrompt += '\nAll menu buttons MUST be real HTML <button> elements — NEVER draw buttons on the canvas.';
    systemPrompt += '\n- Create buttons as <button> elements in the HTML, positioned over the canvas using CSS absolute positioning with z-index.';
    systemPrompt += '\n- Each button MUST have a unique id (e.g. id="btn-start", id="btn-resume", id="btn-menu", id="btn-retry").';
    systemPrompt += '\n- Attach click handlers with addEventListener("click", handlerFunction).';
    systemPrompt += '\n- Style buttons with CSS: cursor:pointer, padding, border-radius, background color, font size, and a :hover effect (e.g. background color change or brightness).';
    systemPrompt += '\n- Show/hide menus by toggling style.display (none/block) on a container div — do NOT recreate buttons each time.';
    systemPrompt += '\n- Buttons must be large enough to click easily (minimum 140px wide, 40px tall) and centered on screen.';
    systemPrompt += '\n- Required buttons by game state:';
    systemPrompt += '\n  • TITLE screen: "Start Game" button (id="btn-start"). Plus any additional menu options requested.';
    systemPrompt += '\n  • PAUSE menu: "Resume" button (id="btn-resume") and "Back to Menu" button (id="btn-menu").';
    systemPrompt += '\n  • GAME OVER screen: "Play Again" / "Retry" button (id="btn-retry") and optionally "Back to Menu" (id="btn-gameover-menu").';

    // ── MANDATORY HUD ──
    systemPrompt += '\n\n═══ MANDATORY HUD (Heads-Up Display) ═══';
    systemPrompt += '\nEvery game MUST display at least one HUD element during gameplay:';
    systemPrompt += '\n- Draw HUD text on the canvas using ctx.fillText() in the render() function.';
    systemPrompt += '\n- Position HUD in a corner (e.g. top-left for score, top-right for health/lives).';
    systemPrompt += '\n- Use a font size of at least 16px with a contrasting color (or outlined text) so it is readable against the game background.';
    systemPrompt += '\n- At minimum display the score. If the genre involves health or lives, display those too.';

    // ── MANDATORY GAME STRUCTURE (State Machine) ──
    systemPrompt += '\n\n═══ MANDATORY GAME STRUCTURE (State Machine) ═══';
    systemPrompt += '\nEvery game MUST use a state variable (e.g. let gameState = "TITLE") to manage transitions:';
    systemPrompt += '\n- TITLE: The initial state when the game loads. Show the Title Screen with the game title and menu buttons. The canvas can show a background color or simple animation. The game loop should NOT update gameplay in this state.';
    systemPrompt += '\n- PLAYING: Active gameplay. The game loop runs update() and render(). The player can move and interact. ESC transitions to PAUSED.';
    systemPrompt += '\n- PAUSED: The game is frozen (no update). Show a Pause Menu overlay with "Resume" and "Back to Menu" buttons. Resume returns to PLAYING, Back to Menu returns to TITLE.';
    systemPrompt += '\n- GAME_OVER: Show the final score and a "Play Again" / "Retry" button. Play Again restarts the game (resets score, health, position). Optionally include "Back to Menu".';
    systemPrompt += '\n- All transitions MUST happen without page reloads. Reset game variables (score, health, player position, enemies) when starting/restarting gameplay.';
    systemPrompt += '\n- Listen for the Escape key (keydown) during PLAYING state to transition to PAUSED.';

    // ── Genre-Specific Requirements ──
    const genre = plan.genre;
    if (genre && GENRE_REQUIREMENTS[genre]) {
      systemPrompt += `\n\n═══ MANDATORY ${genre.toUpperCase()} REQUIREMENTS ═══`;
      systemPrompt += `\nBecause the genre is "${genre}", the game MUST include ALL of the following:`;
      GENRE_REQUIREMENTS[genre].forEach((req, i) => {
        systemPrompt += `\n${i + 1}. ${req}`;
      });
    }

    // ═════════════════════════════════════════════
    // USER PROMPT — Module configuration + output instructions
    // ═════════════════════════════════════════════
    let userPrompt = '';

    if (enabled.coreIdentity) {
      userPrompt += '**Game Concept:**\n';
      if (state.coreIdentity.genre) userPrompt += `- Genre: ${state.coreIdentity.genre}\n`;
      if (state.coreIdentity.theme) userPrompt += `- Setting/Theme: ${state.coreIdentity.theme}\n`;
      const toneLabel = state.coreIdentity.tone <= 20 ? 'Very Dark/Gritty'
        : state.coreIdentity.tone <= 40 ? 'Dark'
        : state.coreIdentity.tone <= 60 ? 'Balanced'
        : state.coreIdentity.tone <= 80 ? 'Bright' : 'Very Bright/Whimsical';
      userPrompt += `- Tone: ${toneLabel}\n`;
      userPrompt += '\n';
    }

    if (!enabled.coreIdentity || !state.coreIdentity.genre) {
      userPrompt += '**Generation Baseline:**\n';
      userPrompt += `- Active Genre: ${plan.genre}\n`;
      userPrompt += '- Build a complete playable loop with objective, scoring/progress, danger/failure, restart, and clear controls.\n';
      userPrompt += '\n';
    }

    if (enabled.mechanics) {
      userPrompt += '**Gameplay Mechanics:**\n';
      if (state.mechanics.tags.length > 0) {
        userPrompt += `- Mechanics: ${state.mechanics.tags.join(', ')}\n`;
        userPrompt += '- Mechanic Implementation Details:\n';
        state.mechanics.tags.forEach(tag => {
          if (MECHANIC_REQUIREMENTS[tag]) {
            userPrompt += `  - ${tag}: ${MECHANIC_REQUIREMENTS[tag]}\n`;
          }
        });
      } else {
        userPrompt += '- Required Core Mechanic: movement plus the primary interaction required by the active genre.\n';
      }
      if (state.mechanics.rules) {
        userPrompt += `- Specific Rules: ${state.mechanics.rules}\n`;
      }
      if (state.mechanics.difficulty) {
        userPrompt += `- Difficulty Curve: ${state.mechanics.difficulty}\n`;
      }
      userPrompt += '\n';
    }

    if (enabled.visuals) {
      userPrompt += '**Visual Requirements:**\n';
      if (state.visuals.artStyle) userPrompt += `- Art Style: ${state.visuals.artStyle}\n`;
      if (state.visuals.artStyle && VISUAL_STYLE_REQUIREMENTS[state.visuals.artStyle]) {
        userPrompt += `- Style Implementation: ${VISUAL_STYLE_REQUIREMENTS[state.visuals.artStyle]}\n`;
      }
      userPrompt += `- Color Palette: Primary ${state.visuals.colorPrimary}, Secondary ${state.visuals.colorSecondary}, Background ${state.visuals.colorBg}\n`;
      if (state.visuals.vfx) userPrompt += `- Visual Effects: ${state.visuals.vfx}\n`;
      userPrompt += '\n';
    }

    if (enabled.gameMenu) {
      userPrompt += '**Game Menu & Controls:**\n';
      userPrompt += `- Requested Menu Type: ${plan.menuType}\n`;
      userPrompt += `- Effective Menu Options: ${plan.menuOptions.join(', ')}\n`;
      userPrompt += `- Effective HUD Elements: ${plan.hudElements.join(', ')}\n`;
      userPrompt += `- Effective Standard Game Actions: ${plan.gameActions.join(', ')}\n`;
      userPrompt += `- Game Over Screen: ${plan.gameOverType}; must include Play Again / Retry.\n`;
      userPrompt += `- ESC Key Behavior: ${plan.escBehavior}\n`;
      userPrompt += '\n';
    }

    if (plan.notes.length > 0) {
      userPrompt += '**Sidebar Compatibility Notes:**\n';
      plan.notes.forEach(note => {
        userPrompt += `- ${note}\n`;
      });
      userPrompt += '\n';
    }

    // Tech stack is always included
    userPrompt += '**Technical Instructions:**\n';
    userPrompt += `- Framework: ${TECH_DEFAULTS.framework}\n`;
    userPrompt += `- Single File: ${isMultiFile ? 'No — separate files (index.html, style.css, game.js)' : 'Yes'}\n`;
    userPrompt += `- Asset Handling: ${TECH_DEFAULTS.assetHandling}\n`;
    userPrompt += '- Do not use external images, fonts, scripts, stylesheets, audio files, or network calls.\n';
    userPrompt += '\n';

    if (enabled.audio) {
      userPrompt += '**Audio & Soundscape:**\n';
      if (state.audio.musicMood) userPrompt += `- Music Mood: ${state.audio.musicMood}\n`;
      if (state.audio.sfx) userPrompt += `- SFX Requirements: ${state.audio.sfx}\n`;
      userPrompt += '- Audio Implementation: optional Web Audio API oscillator/noise effects only, initialized after a user click/key press so autoplay restrictions do not block gameplay.\n';
      userPrompt += '\n';
    }

    // ── Output Requirements + Completeness Checklist ──
    userPrompt += '**Output Requirements:**\n';
    userPrompt += '- Generate a complete, playable game based on the above specifications and the mandatory rules in the system prompt.\n';
    if (isMultiFile) {
      userPrompt += '- Deliver the game as separate files: index.html, style.css, and game.js.\n';
      userPrompt += '- index.html links to style.css and game.js via relative paths.\n';
    } else {
      userPrompt += '- Include all necessary HTML, CSS, and JavaScript in a SINGLE self-contained HTML file.\n';
    }
    userPrompt += '- Make the game immediately playable with no additional setup.\n';
    userPrompt += '- Add clear visual feedback for all player actions (movement, collisions, score changes).\n';
    userPrompt += '- Include a HUD showing score/health/lives/timer as applicable.\n';
    userPrompt += '- Treat sidebar choices as additive; do not omit required states, buttons, input handlers, reset logic, or game-over flow because of a selected menu preference.\n';
    userPrompt += '\n';
    userPrompt += '**COMPLETENESS CHECKLIST — verify before outputting:**\n';
    userPrompt += 'Before you output the code, mentally verify your game includes ALL of the following:\n';
    userPrompt += '☐ A visible player character that responds to keyboard controls\n';
    userPrompt += '☐ Working keyboard controls (Arrow keys/WASD + Spacebar) with keydown/keyup listeners\n';
    userPrompt += '☐ A game loop using requestAnimationFrame with separate update() and render() functions\n';
    userPrompt += '☐ At least one core game mechanic (movement, shooting, jumping, collecting, etc.)\n';
    userPrompt += '☐ Collision detection where applicable (player vs. enemies/obstacles/items)\n';
    userPrompt += '☐ Score or progress tracking displayed in the HUD\n';
    userPrompt += '☐ HTML <button> elements (NOT canvas-drawn) for all menu buttons, with addEventListener click handlers\n';
    userPrompt += '☐ Title Screen with "Start Game" button that works\n';
    userPrompt += '☐ Pause Menu (ESC key) with "Resume" and "Back to Menu" buttons that work\n';
    userPrompt += '☐ Game Over screen with "Play Again"/"Retry" button that works\n';
    userPrompt += '☐ All game state transitions work without page reloads\n';
    if (genre && GENRE_REQUIREMENTS[genre]) {
      userPrompt += `☐ All ${genre}-specific requirements listed in the system prompt are implemented\n`;
    }
    userPrompt += '\n';
    userPrompt += '**OUTPUT FORMAT:**\n';
    if (isMultiFile) {
      userPrompt += '- Output ONLY a raw JSON object (no markdown fences, no explanations before or after).\n';
      userPrompt += '- The JSON must have this exact structure: {"files": [{"path": "index.html", "content": "..."}, {"path": "style.css", "content": "..."}, {"path": "game.js", "content": "..."}]}\n';
      userPrompt += '- The index.html must contain <link rel="stylesheet" href="style.css"> and <script src="game.js"></script>.\n';
      userPrompt += '- All CSS goes in style.css. All JavaScript goes in game.js. index.html contains only HTML structure.\n';
      userPrompt += '- Do NOT include any explanations, introductions, or text before or after the JSON.\n';
    } else {
      userPrompt += '- Output ONLY the HTML code. Start with <!DOCTYPE html> and end with </html>.\n';
      userPrompt += '- Do NOT include any explanations, introductions, or text before or after the code.\n';
      userPrompt += '- Do NOT wrap the code in markdown code fences (no ```html or ``` markers).\n';
      userPrompt += '- Output the raw HTML directly so it can be rendered immediately.\n';
    }

    return { systemPrompt, userPrompt };
  }

  function getFullPromptText() {
    // If prompt is unlocked and has custom text, use that
    if (!promptLocked && customPromptText) {
      return customPromptText;
    }
    const { systemPrompt, userPrompt } = assemblePrompt();
    return `=== SYSTEM PROMPT ===\n${systemPrompt}\n\n=== USER PROMPT ===\n${userPrompt}`;
  }

  // Returns { systemPrompt, userPrompt } for generation,
  // respecting custom edits when prompt is unlocked
  function getPromptForGeneration() {
    if (!promptLocked && customPromptText) {
      // Parse custom text back into system/user sections
      const sysMatch = customPromptText.match(/=== SYSTEM PROMPT ===\n([\s\S]*?)\n=== USER PROMPT ===/);
      const userMatch = customPromptText.match(/=== USER PROMPT ===\n([\s\S]*)/);
      return {
        systemPrompt: sysMatch ? sysMatch[1].trim() : 'You are an expert Game Developer.',
        userPrompt: userMatch ? userMatch[1].trim() : customPromptText,
      };
    }
    return assemblePrompt();
  }

  // ═══════════════════════════════════════════════
  // GENRE-BASED AUTO-CONFIGURATION
  // ═══════════════════════════════════════════════

  function applyGenreDefaults(genre) {
    if (!genre || !GENRE_DEFAULTS[genre]) return;

    const defaults = GENRE_DEFAULTS[genre];

    // Apply genre-specific defaults to state
    if (defaults.mechanics) {
      state.mechanics.tags = [...defaults.mechanics];
    }
    if (defaults.hudElements) {
      state.gameMenu.hudElements = [...defaults.hudElements];
    }
    if (defaults.gameActions) {
      state.gameMenu.gameActions = [...defaults.gameActions];
    }
    if (defaults.menuOptions) {
      state.gameMenu.menuOptions = [...defaults.menuOptions];
    }

    // Re-sync the UI to reflect the new state
    syncUIFromState();
    updatePromptPreview();
    saveState();
    displayConflicts();

    showToast(`Applied ${genre} defaults — adjust as needed`, 'info', 4000);
  }

  // ═══════════════════════════════════════════════
  // CONFLICT VALIDATION
  // ═══════════════════════════════════════════════

  function checkConflicts() {
    const conflicts = [];
    const plan = getGenerationPlan(moduleEnabled);

    // Permadeath + Idle (unusual combo)
    if (state.mechanics.tags.includes('Permadeath') && state.coreIdentity.genre === 'Idle') {
      conflicts.push('Permadeath in an Idle game can be frustrating. Consider removing one or the other.');
    }

    plan.notes.filter(note => !note.startsWith('No genre selected')).forEach(note => {
      conflicts.push(`Generation safety: ${note}`);
    });

    return conflicts;
  }

  function displayConflicts() {
    // Remove existing warnings
    document.querySelectorAll('.conflict-warning').forEach(el => el.remove());

    const conflicts = checkConflicts();
    if (conflicts.length === 0) return;

    const sidebar = document.getElementById('sidebar');
    conflicts.forEach(msg => {
      const div = document.createElement('div');
      div.className = 'conflict-warning';
      div.textContent = msg;
      sidebar.insertBefore(div, sidebar.firstChild);
    });
  }

  // ═══════════════════════════════════════════════
  // API CLIENT
  // ═══════════════════════════════════════════════

  async function callLLM(messages) {
    const baseUrl = apiSettings.baseUrl.replace(/\/+$/, ''); // trim trailing slash
    const provider = apiSettings.provider || detectProviderFromUrl(baseUrl);
    const endpoint = `${baseUrl}/chat/completions`;

    const headers = {
      'Content-Type': 'application/json',
    };

    // Provider-specific auth headers
    if (provider === 'claude') {
      // Anthropic requires x-api-key header and anthropic-version
      headers['x-api-key'] = apiSettings.key;
      headers['anthropic-version'] = '2023-06-01';
    } else if (apiSettings.key) {
      headers['Authorization'] = `Bearer ${apiSettings.key}`;
    }

    const maxTokens = getEffectiveMaxTokens();

    // Build request body — Claude uses a different format
    let body;
    if (provider === 'claude') {
      // Anthropic Messages API format (max_tokens is required for Claude)
      const systemMsg = messages.find(m => m.role === 'system');
      const userMessages = messages.filter(m => m.role !== 'system');
      body = {
        model: apiSettings.model,
        messages: userMessages,
        max_tokens: maxTokens || 200000, // Claude requires this field
        temperature: parseFloat(apiSettings.temperature) || 0.7,
      };
      if (systemMsg) body.system = systemMsg.content;
    } else {
      // OpenAI-compatible format (OpenAI, Gemini, Ollama, LM Studio)
      body = {
        model: apiSettings.model,
        messages,
        temperature: parseFloat(apiSettings.temperature) || 0.7,
      };
      if (maxTokens) body.max_tokens = maxTokens; // omit when null (no limit)
    }

    // Claude uses a different endpoint
    const finalEndpoint = provider === 'claude'
      ? `${baseUrl}/messages`
      : endpoint;

    const res = await fetch(finalEndpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => 'Unknown error');
      throw new Error(`API Error ${res.status}: ${errText}`);
    }

    const data = await res.json();

    // Parse response based on provider
    if (provider === 'claude') {
      const content = data.content?.[0]?.text;
      if (!content) throw new Error('API returned empty response');
      return content;
    } else {
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error('API returned empty response');
      return content;
    }
  }

  // ═══════════════════════════════════════════════
  // STREAMING API CLIENT (with live view support)
  // ═══════════════════════════════════════════════

  async function* callLLMStream(messages) {
    const baseUrl = apiSettings.baseUrl.replace(/\/+$/, '');
    const provider = apiSettings.provider || detectProviderFromUrl(baseUrl);
    const endpoint = `${baseUrl}/chat/completions`;

    const headers = { 'Content-Type': 'application/json' };
    if (provider === 'claude') {
      headers['x-api-key'] = apiSettings.key;
      headers['anthropic-version'] = '2023-06-01';
    } else if (apiSettings.key) {
      headers['Authorization'] = `Bearer ${apiSettings.key}`;
    }

    const maxTokens = getEffectiveMaxTokens();

    let body;
    if (provider === 'claude') {
      const systemMsg = messages.find(m => m.role === 'system');
      const userMessages = messages.filter(m => m.role !== 'system');
      body = {
        model: apiSettings.model,
        messages: userMessages,
        max_tokens: maxTokens || 200000, // Claude requires this field
        temperature: parseFloat(apiSettings.temperature) || 0.7,
        stream: true,
      };
      if (systemMsg) body.system = systemMsg.content;
    } else {
      body = {
        model: apiSettings.model,
        messages,
        temperature: parseFloat(apiSettings.temperature) || 0.7,
        stream: true,
      };
      if (maxTokens) body.max_tokens = maxTokens; // omit when null (no limit)
    }

    const finalEndpoint = provider === 'claude'
      ? `${baseUrl}/messages`
      : endpoint;

    const res = await fetch(finalEndpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => 'Unknown error');
      throw new Error(`API Error ${res.status}: ${errText}`);
    }

    // Check if response is actually streamed (SSE)
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('text/event-stream') || !res.body) {
      // Fallback: non-streaming response — yield entire content at once
      const data = await res.json();
      if (provider === 'claude') {
        const content = data.content?.[0]?.text;
        if (!content) throw new Error('API returned empty response');
        yield content;
      } else {
        const content = data.choices?.[0]?.message?.content;
        if (!content) throw new Error('API returned empty response');
        yield content;
      }
      return;
    }

    // Parse SSE stream
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process complete SSE lines
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep incomplete line in buffer

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;

        const dataStr = trimmed.slice(5).trim();
        if (dataStr === '[DONE]') return;

        try {
          const chunk = JSON.parse(dataStr);
          if (provider === 'claude') {
            // Anthropic streaming format
            if (chunk.type === 'content_block_delta' && chunk.delta?.text) {
              yield chunk.delta.text;
            }
          } else {
            // OpenAI-compatible streaming format
            const delta = chunk.choices?.[0]?.delta?.content;
            if (delta) yield delta;
          }
        } catch (e) {
          // Skip malformed JSON chunks
        }
      }
    }
  }

  // ── Get effective max tokens based on output mode ──
  function getEffectiveMaxTokens() {
    // Multi-file mode: no token limit (let the AI use as much as it needs)
    // Single-file mode: 100,000 tokens
    if (state.outputMode === 'multi') return null;
    return 100000;
  }

  // ═══════════════════════════════════════════════
  // LIVE VIEW (streaming output display)
  // ═══════════════════════════════════════════════

  let liveViewActive = false;
  let liveViewFullText = '';
  let liveViewThinkingText = '';
  let liveViewCodeText = '';
  let liveViewInCode = false;

  function liveViewStart() {
    liveViewActive = true;
    liveViewFullText = '';
    liveViewThinkingText = '';
    liveViewCodeText = '';
    liveViewInCode = false;

    const placeholder = document.getElementById('liveview-placeholder');
    const thinkingSection = document.getElementById('liveview-thinking');
    const codeSection = document.getElementById('liveview-code');
    const status = document.getElementById('liveview-status');

    if (placeholder) placeholder.classList.add('hidden');
    if (thinkingSection) thinkingSection.classList.remove('hidden');
    if (codeSection) codeSection.classList.add('hidden'); // hidden until code starts
    if (status) {
      status.textContent = '⏳ Thinking...';
      status.className = 'liveview-status active';
    }

    const thinkingContent = document.getElementById('liveview-thinking-content');
    const codeContent = document.getElementById('liveview-code-content');
    if (thinkingContent) thinkingContent.textContent = '';
    if (codeContent) codeContent.textContent = '';

    // Auto-switch to Live View tab
    switchTab('liveview');
  }

  function liveViewAppendChunk(chunk) {
    if (!liveViewActive) return;
    liveViewFullText += chunk;

    // Detect code boundaries: look for <!DOCTYPE, <html, ```html, ```json, { "files"
    // Everything before code starts is "thinking"
    const codeStartPatterns = [
      /<!DOCTYPE\s+html/i,
      /<html/i,
      /```html/i,
      /```json/i,
      /^\s*\{\s*"files"\s*:/i,
    ];

    if (!liveViewInCode) {
      // Check if the accumulated text now contains a code start marker
      for (const pattern of codeStartPatterns) {
        if (pattern.test(liveViewFullText)) {
          liveViewInCode = true;
          // Split: everything before the match is thinking, from match onward is code
          const matchIdx = liveViewFullText.search(pattern);
          if (matchIdx > 0) {
            liveViewThinkingText = liveViewFullText.slice(0, matchIdx).trim();
          }
          liveViewCodeText = liveViewFullText.slice(matchIdx);

          // Update thinking section (final)
          const thinkingContent = document.getElementById('liveview-thinking-content');
          if (thinkingContent) thinkingContent.textContent = liveViewThinkingText;

          // Show code section
          const codeSection = document.getElementById('liveview-code');
          if (codeSection) codeSection.classList.remove('hidden');

          // Update status
          const status = document.getElementById('liveview-status');
          if (status) {
            status.textContent = '💻 Building code...';
          }
          break;
        }
      }

      if (!liveViewInCode) {
        // Still in thinking phase — update thinking content
        liveViewThinkingText = liveViewFullText;
        const thinkingContent = document.getElementById('liveview-thinking-content');
        if (thinkingContent) thinkingContent.textContent = liveViewThinkingText;

        // Auto-scroll thinking content
        if (thinkingContent) {
          thinkingContent.scrollTop = thinkingContent.scrollHeight;
        }
      }
    }

    if (liveViewInCode) {
      // Slice from where code started — use the combined pattern
      const codeStartMatch = liveViewFullText.search(
        /<!DOCTYPE\s+html|<html|```html|```json|\{\s*"files"\s*:/i
      );
      if (codeStartMatch !== -1) {
        liveViewCodeText = liveViewFullText.slice(codeStartMatch);
      }

      const codeContent = document.getElementById('liveview-code-content');
      if (codeContent) {
        codeContent.textContent = liveViewCodeText;
        codeContent.scrollTop = codeContent.scrollHeight;
      }

      // Update code stats
      const stats = document.getElementById('liveview-code-stats');
      if (stats) {
        const lines = liveViewCodeText.split('\n').length;
        const chars = liveViewCodeText.length;
        stats.textContent = `${lines} lines · ${chars} chars`;
      }
    }
  }

  function liveViewFinish() {
    liveViewActive = false;
    const status = document.getElementById('liveview-status');
    if (status) {
      status.textContent = '✅ Complete';
      status.className = 'liveview-status done';
    }

    // If we never detected code, show everything as thinking
    if (!liveViewInCode && liveViewFullText) {
      const thinkingContent = document.getElementById('liveview-thinking-content');
      if (thinkingContent) thinkingContent.textContent = liveViewFullText;
    }
  }

  function liveViewError(message) {
    liveViewActive = false;
    const status = document.getElementById('liveview-status');
    if (status) {
      status.textContent = '❌ Error';
      status.className = 'liveview-status error';
    }
    const thinkingSection = document.getElementById('liveview-thinking');
    const thinkingContent = document.getElementById('liveview-thinking-content');
    if (thinkingSection) thinkingSection.classList.remove('hidden');
    if (thinkingContent) {
      thinkingContent.textContent = (liveViewThinkingText || '') + '\n\n❌ ERROR: ' + message;
    }
  }

  function liveViewClear() {
    liveViewFullText = '';
    liveViewThinkingText = '';
    liveViewCodeText = '';
    liveViewInCode = false;
    liveViewActive = false;

    const placeholder = document.getElementById('liveview-placeholder');
    const thinkingSection = document.getElementById('liveview-thinking');
    const codeSection = document.getElementById('liveview-code');
    const status = document.getElementById('liveview-status');
    const thinkingContent = document.getElementById('liveview-thinking-content');
    const codeContent = document.getElementById('liveview-code-content');
    const stats = document.getElementById('liveview-code-stats');

    if (placeholder) placeholder.classList.remove('hidden');
    if (thinkingSection) thinkingSection.classList.add('hidden');
    if (codeSection) codeSection.classList.add('hidden');
    if (status) {
      status.textContent = 'Idle';
      status.className = 'liveview-status';
    }
    if (thinkingContent) thinkingContent.textContent = '';
    if (codeContent) codeContent.textContent = '';
    if (stats) stats.textContent = '';
  }

  // ── Detect provider from base URL ──
  function detectProviderFromUrl(url) {
    const lower = url.toLowerCase();
    if (lower.includes('anthropic') || lower.includes('claude')) return 'claude';
    if (lower.includes('generativelanguage') || lower.includes('gemini')) return 'gemini';
    if (lower.includes('localhost:11434') || lower.includes('ollama')) return 'ollama';
    if (lower.includes('localhost:1234') || lower.includes('lmstudio')) return 'lmstudio';
    if (lower.includes('openai')) return 'openai';
    return 'custom'; // default to custom for unknown URLs
  }

  // ═══════════════════════════════════════════════
  // TEST API CONNECTION
  // ═══════════════════════════════════════════════

  async function testApiConnection() {
    const statusEl = document.getElementById('connection-status');
    const btn = document.getElementById('btn-test-connection');
    const baseUrl = document.getElementById('apiBaseUrl').value.trim().replace(/\/+$/, '');
    const apiKey = document.getElementById('apiKey').value.trim();
    const model = document.getElementById('modelName').value.trim();
    const activeProviderBtn = document.querySelector('.provider-btn.active');
    const provider = activeProviderBtn ? activeProviderBtn.dataset.provider : detectProviderFromUrl(baseUrl);

    if (!baseUrl) {
      statusEl.textContent = '❌ Base URL is required';
      statusEl.className = 'connection-status error';
      return;
    }

    // Show testing state
    btn.classList.add('loading');
    btn.disabled = true;
    statusEl.textContent = '⏳ Testing connection...';
    statusEl.className = 'connection-status testing';

    try {
      // First, try to fetch models list (lightweight check)
      const modelsAvailable = await fetchModelsList(baseUrl, apiKey, provider, true);

      if (modelsAvailable.length > 0) {
        statusEl.textContent = `✅ Connected! Found ${modelsAvailable.length} model(s)`;
        statusEl.className = 'connection-status success';
      } else {
        // If no models endpoint, try a minimal chat completion
        await testMinimalCompletion(baseUrl, apiKey, model, provider);
        statusEl.textContent = '✅ Connected! API responded successfully';
        statusEl.className = 'connection-status success';
      }
    } catch (err) {
      statusEl.textContent = `❌ ${err.message}`;
      statusEl.className = 'connection-status error';
    } finally {
      btn.classList.remove('loading');
      btn.disabled = false;
    }
  }

  // ── Minimal completion test ──
  async function testMinimalCompletion(baseUrl, apiKey, model, provider) {
    const headers = { 'Content-Type': 'application/json' };
    if (provider === 'claude') {
      headers['x-api-key'] = apiKey;
      headers['anthropic-version'] = '2023-06-01';
    } else if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    let endpoint, body;
    if (provider === 'claude') {
      endpoint = `${baseUrl}/messages`;
      body = {
        model: model || 'claude-sonnet-4-20250514',
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 5,
      };
    } else {
      endpoint = `${baseUrl}/chat/completions`;
      body = {
        model: model || 'gpt-4o',
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 5,
      };
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => 'Unknown error');
      throw new Error(`API Error ${res.status}: ${errText.slice(0, 200)}`);
    }
  }

  // ═══════════════════════════════════════════════
  // AUTO-FETCH MODELS
  // ═══════════════════════════════════════════════

  async function fetchModelsList(baseUrl, apiKey, provider, silent = false) {
    const headers = {};
    if (provider === 'claude') {
      headers['x-api-key'] = apiKey;
      headers['anthropic-version'] = '2023-06-01';
    } else if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    let modelsEndpoint;
    if (provider === 'claude') {
      // Anthropic doesn't have a models list endpoint in the same way
      // Return preset models
      return PROVIDER_PRESETS.claude.models;
    } else if (provider === 'gemini') {
      // Gemini OpenAI-compatible endpoint supports /models
      modelsEndpoint = `${baseUrl}/models`;
    } else {
      // OpenAI, Ollama, LM Studio all support /models or /v1/models
      modelsEndpoint = `${baseUrl}/models`;
    }

    try {
      const res = await fetch(modelsEndpoint, { headers });
      if (!res.ok) {
        // If /models fails, try the provider's native endpoint
        if (provider === 'ollama') {
          // Ollama native API
          const nativeRes = await fetch(baseUrl.replace(/\/v1$/, '') + '/api/tags');
          if (nativeRes.ok) {
            const data = await nativeRes.json();
            return (data.models || []).map(m => m.name || m.model);
          }
        }
        if (provider === 'lmstudio') {
          // LM Studio native API
          const nativeRes = await fetch(baseUrl.replace(/\/v1$/, '') + '/api/v0/models');
          if (nativeRes.ok) {
            const data = await nativeRes.json();
            return (data.data || []).map(m => m.id);
          }
        }
        throw new Error(`Models endpoint returned ${res.status}`);
      }

      const data = await res.json();

      // OpenAI-compatible format: { data: [{ id: "model-name", ... }] }
      if (data.data && Array.isArray(data.data)) {
        return data.data.map(m => m.id).filter(Boolean);
      }

      // Gemini format: { models: [{ name: "models/gemini-...", ... }] }
      if (data.models && Array.isArray(data.models)) {
        return data.models.map(m => {
          // Gemini returns "models/gemini-2.0-flash" — strip the "models/" prefix
          const name = m.name || m.id || '';
          return name.replace(/^models\//, '');
        }).filter(Boolean);
      }

      return [];
    } catch (err) {
      if (!silent) throw err;
      return [];
    }
  }

  async function autoFetchModels() {
    const statusEl = document.getElementById('model-fetch-status');
    const btn = document.getElementById('btn-fetch-models');
    const baseUrl = document.getElementById('apiBaseUrl').value.trim().replace(/\/+$/, '');
    const apiKey = document.getElementById('apiKey').value.trim();
    const activeProviderBtn = document.querySelector('.provider-btn.active');
    const provider = activeProviderBtn ? activeProviderBtn.dataset.provider : detectProviderFromUrl(baseUrl);

    if (!baseUrl) {
      statusEl.textContent = '❌ Enter a Base URL first';
      statusEl.className = 'model-fetch-status error';
      return;
    }

    btn.classList.add('loading');
    btn.disabled = true;
    statusEl.textContent = '⏳ Fetching models...';
    statusEl.className = 'model-fetch-status';

    try {
      const models = await fetchModelsList(baseUrl, apiKey, provider);

      if (models.length === 0) {
        statusEl.textContent = '⚠️ No models found. Check your server is running.';
        statusEl.className = 'model-fetch-status error';
        return;
      }

      // Sort models alphabetically
      models.sort((a, b) => a.localeCompare(b));

      // Populate the model dropdown
      const modelSelect = document.getElementById('modelPreset');
      modelSelect.innerHTML = '<option value="">— Quick Select —</option>';
      models.forEach(model => {
        const opt = document.createElement('option');
        opt.value = model;
        opt.textContent = model;
        modelSelect.appendChild(opt);
      });

      // Also update the provider preset models for future use
      if (provider && PROVIDER_PRESETS[provider]) {
        PROVIDER_PRESETS[provider].models = models;
      }

      // Auto-select first model if current model is empty
      const modelNameInput = document.getElementById('modelName');
      if (!modelNameInput.value.trim() && models.length > 0) {
        modelNameInput.value = models[0];
      }

      statusEl.textContent = `✅ Found ${models.length} model(s)`;
      statusEl.className = 'model-fetch-status success';
    } catch (err) {
      statusEl.textContent = `❌ ${err.message}`;
      statusEl.className = 'model-fetch-status error';
    } finally {
      btn.classList.remove('loading');
      btn.disabled = false;
    }
  }

  // ═══════════════════════════════════════════════
  // CODE EXTRACTION
  // ═══════════════════════════════════════════════

  function extractCode(response) {
    // Try to extract from markdown code fences
    // Patterns: ```html ... ```, ```javascript ... ```, ``` ... ```
    // Allow optional whitespace after the language identifier
    const patterns = [
      /```html\s*?\n([\s\S]*?)```/i,
      /```javascript\s*?\n([\s\S]*?)```/i,
      /```js\s*?\n([\s\S]*?)```/i,
      /```\s*?\n([\s\S]*?)```/,
    ];

    for (const pattern of patterns) {
      const match = response.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    // If no fences found, check if the response looks like HTML
    const trimmed = response.trim();
    if (trimmed.toLowerCase().startsWith('<!doctype') || trimmed.toLowerCase().startsWith('<html') || trimmed.toLowerCase().startsWith('<head')) {
      return trimmed;
    }

    // Check if response contains HTML somewhere (AI may have added intro text)
    const htmlStart = trimmed.search(/<!DOCTYPE\s+html/i);
    if (htmlStart !== -1) {
      // Extract from <!DOCTYPE html> to the end
      const fromDoctype = trimmed.slice(htmlStart);
      // Try to find the closing </html> tag
      const htmlEnd = fromDoctype.lastIndexOf('</html>');
      if (htmlEnd !== -1) {
        return fromDoctype.slice(0, htmlEnd + 7).trim();
      }
      return fromDoctype.trim();
    }

    // Last resort: return the whole response
    return trimmed;
  }

  // ═══════════════════════════════════════════════
  // MULTI-FILE CODE EXTRACTION
  // ═══════════════════════════════════════════════

  function extractMultiFileCode(response) {
    const trimmed = response.trim();

    // 1. Try stripping markdown code fences (```json ... ```)
    const fenceMatch = trimmed.match(/```(?:json)?\s*\n([\s\S]*?)\n```/i);
    let jsonStr = fenceMatch ? fenceMatch[1].trim() : trimmed;

    // 2. Try direct JSON.parse
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed.files && Array.isArray(parsed.files)) {
        return validateAndNormalizeFiles(parsed.files);
      }
    } catch (e) {
      // Not valid JSON, continue to fallbacks
    }

    // 3. Try to find {"files": ... } pattern via regex
    const filesMatch = trimmed.match(/\{\s*"files"\s*:\s*\[[\s\S]*?\]\s*\}/);
    if (filesMatch) {
      try {
        const parsed = JSON.parse(filesMatch[0]);
        if (parsed.files && Array.isArray(parsed.files)) {
          return validateAndNormalizeFiles(parsed.files);
        }
      } catch (e) {
        // Still not valid JSON
      }
    }

    // 4. Fallback: treat as single-file HTML, wrap in files array
    const code = extractCode(response);
    return [{ path: 'index.html', content: code }];
  }

  function validateAndNormalizeFiles(files) {
    // Ensure each file has path and content
    const normalized = files
      .filter(f => f && typeof f.path === 'string' && typeof f.content === 'string')
      .map(f => ({ path: f.path.trim(), content: f.content }));

    // Check for required files
    const hasIndex = normalized.some(f => f.path === 'index.html');
    const hasCSS = normalized.some(f => f.path === 'style.css');
    const hasJS = normalized.some(f => f.path === 'game.js');

    if (!hasIndex || !hasCSS || !hasJS) {
      const missing = [];
      if (!hasIndex) missing.push('index.html');
      if (!hasCSS) missing.push('style.css');
      if (!hasJS) missing.push('game.js');
      showToast(`⚠️ Multi-file output missing: ${missing.join(', ')}. Game may not work correctly.`, 'warning', 6000);
    }

    return normalized;
  }

  function validateMultiFileGame(files) {
    const warnings = [];
    const indexFile = files.find(f => f.path === 'index.html');
    const cssFile = files.find(f => f.path === 'style.css');
    const jsFile = files.find(f => f.path === 'game.js');

    if (!indexFile) {
      warnings.push('index.html file');
    } else {
      // Check that index.html references style.css and game.js
      if (!/<link[^>]*style\.css/i.test(indexFile.content)) {
        warnings.push('link to style.css in index.html');
      }
      if (!/<script[^>]*game\.js/i.test(indexFile.content)) {
        warnings.push('script tag for game.js in index.html');
      }
    }

    if (!cssFile || cssFile.content.trim().length === 0) {
      warnings.push('style.css file (empty or missing)');
    }
    if (!jsFile || jsFile.content.trim().length === 0) {
      warnings.push('game.js file (empty or missing)');
    }

    // Validate game.js for essential game elements
    if (jsFile) {
      const code = jsFile.content;
      const codeChecks = [
        { pattern: /<canvas|getElementById\s*\(\s*['"]canvas/i, label: 'canvas reference' },
        { pattern: /requestAnimationFrame|setInterval/i, label: 'game loop' },
        { pattern: /addEventListener/i, label: 'event listeners' },
        { pattern: /keydown|keyup/i, label: 'keyboard input' },
        { pattern: /ctx\./i, label: 'canvas rendering (ctx.)' },
      ];
      codeChecks.forEach(check => {
        if (!check.pattern.test(code)) warnings.push(check.label);
      });
    }

    return warnings;
  }

  // ═══════════════════════════════════════════════
  // IFRAME RENDERING
  // ═══════════════════════════════════════════════

  function renderInIframe(code) {
    const iframe = document.getElementById('game-iframe');
    const placeholder = document.getElementById('iframe-placeholder');
    const errorPanel = document.getElementById('error-panel');

    // Hide error panel by default
    if (errorPanel) errorPanel.classList.add('hidden');

    try {
      // Use srcdoc for normal-sized code
      iframe.srcdoc = code;
      placeholder.classList.add('hidden');
      lastGeneratedCode = code;

      // Switch to sandbox tab
      switchTab('sandbox');

      // Listen for iframe errors
      iframe.onload = function() {
        try {
          const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
          // Check if the iframe content looks like it has an error (empty body or error text)
          if (iframeDoc && iframeDoc.body && iframeDoc.body.innerHTML.trim() === '') {
            // The page loaded but is empty — might still be rendering
          }
        } catch (e) {
          // Cross-origin — can't inspect, which is fine
        }
      };
    } catch (e) {
      // Fallback to Blob URL for very large code
      try {
        const blob = new Blob([code], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        iframe.src = url;
        iframe.removeAttribute('srcdoc');
        placeholder.classList.add('hidden');
        lastGeneratedCode = code;
        switchTab('sandbox');
      } catch (e2) {
        showToast('Failed to render game: ' + e2.message, 'error');
        showErrorInPanel('Failed to render game: ' + e2.message);
      }
    }
  }

  // ═══════════════════════════════════════════════
  // MULTI-FILE IFRAME RENDERING
  // ═══════════════════════════════════════════════

  function renderMultiFileInIframe(files) {
    const indexFile = files.find(f => f.path === 'index.html');
    const cssFile = files.find(f => f.path === 'style.css');
    const jsFile = files.find(f => f.path === 'game.js');

    if (!indexFile) {
      showToast('No index.html found in generated files', 'error');
      showErrorInPanel('No index.html found in generated files');
      return;
    }

    let html = indexFile.content;

    // Inline CSS: replace <link rel="stylesheet" href="style.css"> with <style>...</style>
    if (cssFile) {
      html = html.replace(
        /<link[^>]*rel=["']stylesheet["'][^>]*href=["']style\.css["'][^>]*>/gi,
        `<style>\n${cssFile.content}\n</style>`
      );
      // Also handle href before rel
      html = html.replace(
        /<link[^>]*href=["']style\.css["'][^>]*rel=["']stylesheet["'][^>]*>/gi,
        `<style>\n${cssFile.content}\n</style>`
      );
    }

    // Inline JS: replace <script src="game.js"></script> with <script>...</script>
    if (jsFile) {
      html = html.replace(
        /<script[^>]*src=["']game\.js["'][^>]*><\/script>/gi,
        `<script>\n${jsFile.content}\n</script>`
      );
    }

    // Handle any remaining asset references — replace with placeholder comments
    // (assets folder files are not inlined; document this limitation)
    html = html.replace(
      /<img[^>]*src=["'](?!data:)[^"']*["'][^>]*>/gi,
      (match) => {
        // Replace img tags referencing local files with a placeholder div
        return match.replace(/src=["'][^"']*["']/i, 'src="data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'48\' height=\'48\'%3E%3Crect width=\'48\' height=\'48\' fill=\'%236c5ce7\'/%3E%3C/svg%3E"');
      }
    );

    // Store files for download
    lastGeneratedFiles = files;
    lastGeneratedCode = html; // also store inlined version for refresh

    // Render using the existing iframe path
    renderInIframe(html);

    // Populate file browser
    renderFileBrowser(files);
  }

  // ═══════════════════════════════════════════════
  // FILE BROWSER
  // ═══════════════════════════════════════════════

  function renderFileBrowser(files) {
    const fileList = document.getElementById('file-list');
    if (!fileList) return;

    if (!files || files.length === 0) {
      fileList.innerHTML = '<p class="placeholder">No files generated yet.</p>';
      return;
    }

    const fileIcons = {
      '.html': '🌐',
      '.css': '🎨',
      '.js': '⚡',
      '.json': '📋',
      '.png': '🖼️',
      '.jpg': '🖼️',
      '.svg': '🖼️',
    };

    fileList.innerHTML = files.map((file, idx) => {
      const ext = file.path.match(/\.\w+$/)?.[0]?.toLowerCase() || '';
      const icon = fileIcons[ext] || '📄';
      const lineCount = file.content.split('\n').length;
      return `
        <div class="file-item" data-idx="${idx}" data-path="${escapeHtml(file.path)}">
          <span class="file-item-icon">${icon}</span>
          <span class="file-item-name">${escapeHtml(file.path)}</span>
        </div>
      `;
    }).join('');

    // Attach click handlers
    fileList.querySelectorAll('.file-item').forEach(item => {
      item.addEventListener('click', () => {
        const idx = parseInt(item.dataset.idx);
        showFileInViewer(files[idx]);
        // Highlight active file
        fileList.querySelectorAll('.file-item').forEach(fi => fi.classList.remove('active'));
        item.classList.add('active');
      });
    });

    // Auto-select first file (index.html)
    if (files.length > 0) {
      const firstItem = fileList.querySelector('.file-item');
      if (firstItem) firstItem.click();
    }
  }

  function showFileInViewer(file) {
    const pathEl = document.getElementById('file-viewer-path');
    const contentEl = document.getElementById('file-viewer-content');
    const metaEl = document.getElementById('file-viewer-meta');

    if (pathEl) pathEl.textContent = file.path;
    if (contentEl) contentEl.textContent = file.content;
    if (metaEl) {
      const lines = file.content.split('\n').length;
      const chars = file.content.length;
      metaEl.textContent = `${lines} lines · ${chars} chars`;
    }
  }

  function showErrorInPanel(message) {
    const errorPanel = document.getElementById('error-panel');
    const errorText = document.getElementById('error-text');
    if (errorPanel && errorText) {
      errorText.textContent = message;
      errorPanel.classList.remove('hidden');
    }
  }

  function hideErrorPanel() {
    const errorPanel = document.getElementById('error-panel');
    if (errorPanel) errorPanel.classList.add('hidden');
  }

  // ═══════════════════════════════════════════════
  // CODE VALIDATION
  // ═══════════════════════════════════════════════

  function validateGameCode(code) {
    const warnings = [];

    // Check for essential game elements using regex
    const checks = [
      { pattern: /<canvas/i, label: 'canvas element' },
      { pattern: /requestAnimationFrame|setInterval/i, label: 'game loop (requestAnimationFrame)' },
      { pattern: /addEventListener/i, label: 'event listeners' },
      { pattern: /keydown|keyup/i, label: 'keyboard input handling (keydown/keyup)' },
      { pattern: /ctx\./i, label: 'canvas rendering calls (ctx.)' },
      { pattern: /<button|createElement\s*\(\s*['"]button/i, label: 'HTML buttons for menus' },
      { pattern: /btn-start|startGame|start-game/i, label: 'working Start Game button/handler' },
      { pattern: /btn-resume|resumeGame|resume-game/i, label: 'working Resume button/handler' },
      { pattern: /btn-menu|backToMenu|back-to-menu/i, label: 'working Back to Menu button/handler' },
      { pattern: /btn-retry|retry|playAgain|play-again/i, label: 'working Retry/Play Again button/handler' },
      { pattern: /TITLE/i, label: 'TITLE state' },
      { pattern: /PAUSED|pause/i, label: 'PAUSED state' },
      { pattern: /GAME_OVER|gameOver|game-over/i, label: 'GAME_OVER state' },
    ];

    checks.forEach(check => {
      if (!check.pattern.test(code)) {
        warnings.push(check.label);
      }
    });

    return warnings;
  }

  function showValidationWarnings(warnings) {
    if (warnings.length === 0) return;
    const message = '⚠️ Game may be missing: ' + warnings.join(', ') + '. Try refining or regenerating.';
    showToast(message, 'warning', 6000);
  }

  // ═══════════════════════════════════════════════
  // GENERATE GAME
  // ═══════════════════════════════════════════════

  async function generateGame() {
    if (isGenerating) return;

    // Validate API settings
    if (!apiSettings.baseUrl) {
      showToast('Please configure API settings first (⚙️)', 'warning');
      openModal('modal-settings');
      return;
    }

    // Check for conflicts
    const conflicts = checkConflicts();
    if (conflicts.length > 0) {
      // Show conflicts but allow user to proceed
      displayConflicts();
    }

    isGenerating = true;
    hideErrorPanel();
    document.getElementById('btn-generate').disabled = true;

    try {
      const { systemPrompt, userPrompt } = getPromptForGeneration();

      // Build conversation
      conversationHistory = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ];

      // Stream the response with live view
      liveViewStart();
      let response = '';
      for await (const chunk of callLLMStream(conversationHistory)) {
        response += chunk;
        liveViewAppendChunk(chunk);
      }
      liveViewFinish();
      conversationHistory.push({ role: 'assistant', content: response });

      if (state.outputMode === 'multi') {
        // Multi-file mode
        const files = extractMultiFileCode(response);
        if (!files || files.length === 0) {
          throw new Error('The AI returned no files. Try adjusting your settings or prompt.');
        }
        renderMultiFileInIframe(files);
        const warnings = validateMultiFileGame(files);
        showValidationWarnings(warnings);
        saveToHistory(null, false, files);
      } else {
        // Single-file mode
        const code = extractCode(response);
        if (!code || code.trim().length === 0) {
          throw new Error('The AI returned empty code. Try adjusting your settings or prompt.');
        }
        renderInIframe(code);
        const warnings = validateGameCode(code);
        showValidationWarnings(warnings);
        saveToHistory(code);
      }

      showToast('Game generated successfully! 🎮', 'success');
    } catch (err) {
      console.error('Generation failed:', err);
      liveViewError(err.message);
      showToast('Generation failed: ' + err.message, 'error', 5000);
      showErrorInPanel('Generation failed: ' + err.message);
    } finally {
      isGenerating = false;
      document.getElementById('btn-generate').disabled = false;
    }
  }

  // ═══════════════════════════════════════════════
  // REFINE FEATURE
  // ═══════════════════════════════════════════════

  async function refineGame(instruction) {
    if (isGenerating) return;
    if (!conversationHistory.length) {
      showToast('Generate a game first before refining', 'warning');
      return;
    }

    isGenerating = true;
    hideErrorPanel();
    document.getElementById('btn-refine').disabled = true;

    try {
      // Build refinement prompt — include current files for multi-file mode
      let refineContent;
      if (state.outputMode === 'multi' && lastGeneratedFiles) {
        const filesJson = JSON.stringify({ files: lastGeneratedFiles }, null, 2);
        refineContent = `Refine the game with this change: ${instruction}\n\nHere are the current files:\n${filesJson}\n\nReturn the COMPLETE updated files as a JSON object with the same structure: {"files": [{"path": "...", "content": "..."}]}. Do not omit any parts. Do not wrap in markdown fences.`;
      } else {
        refineContent = `Refine the game with this change: ${instruction}\n\nReturn the COMPLETE updated game code. Do not omit any parts.`;
      }

      conversationHistory.push({
        role: 'user',
        content: refineContent,
      });

      // Stream the response with live view
      liveViewStart();
      let response = '';
      for await (const chunk of callLLMStream(conversationHistory)) {
        response += chunk;
        liveViewAppendChunk(chunk);
      }
      liveViewFinish();
      conversationHistory.push({ role: 'assistant', content: response });

      if (state.outputMode === 'multi') {
        // Multi-file mode
        const files = extractMultiFileCode(response);
        if (!files || files.length === 0) {
          throw new Error('The AI returned no files. Try rephrasing your refinement.');
        }
        renderMultiFileInIframe(files);
        const warnings = validateMultiFileGame(files);
        showValidationWarnings(warnings);
        saveToHistory(null, true, files);
      } else {
        // Single-file mode
        const code = extractCode(response);
        if (!code || code.trim().length === 0) {
          throw new Error('The AI returned empty code. Try rephrasing your refinement.');
        }
        renderInIframe(code);
        const warnings = validateGameCode(code);
        showValidationWarnings(warnings);
        saveToHistory(code, true);
      }

      showToast('Game refined! 🔄', 'success');
      document.getElementById('refine-input').value = '';
    } catch (err) {
      console.error('Refine failed:', err);
      liveViewError(err.message);
      showToast('Refine failed: ' + err.message, 'error', 5000);
      showErrorInPanel('Refine failed: ' + err.message);
    } finally {
      isGenerating = false;
      document.getElementById('btn-refine').disabled = false;
    }
  }

  // ═══════════════════════════════════════════════
  // HISTORY
  // ═══════════════════════════════════════════════

  function saveToHistory(code, isRefine = false, files = null) {
    const list = readHistory();
    const genre = state.coreIdentity.genre || 'Unknown';
    const theme = state.coreIdentity.theme || 'Untitled';

    const entry = {
      id: uid(),
      title: `${genre} — ${theme}`,
      genre,
      theme,
      code: code || undefined,
      files: files || undefined,
      outputMode: state.outputMode || 'single',
      config: deepClone(state),
      moduleEnabled: deepClone(moduleEnabled),
      timestamp: Date.now(),
      isRefine,
    };

    list.unshift(entry);
    writeHistory(list);
  }

  function renderHistory() {
    const list = readHistory();
    const container = document.getElementById('history-list');

    if (list.length === 0) {
      container.innerHTML = '<p class="placeholder">No generations yet. Create your first game!</p>';
      return;
    }

    container.innerHTML = list.map(item => `
      <div class="history-item" data-id="${item.id}">
        <div class="history-info">
          <div class="history-title">${escapeHtml(item.title)}</div>
          <div class="history-meta">${formatTimestamp(item.timestamp)}${item.isRefine ? ' · Refined' : ''}${(item.outputMode === 'multi' || (item.files && item.files.length)) ? ' · 📁 Multi' : ''}</div>
        </div>
        <div class="history-actions">
          <button class="btn btn-sm" onclick="window.__loadHistory('${item.id}')" title="Load this game">📂 Load</button>
          <button class="btn btn-sm btn-danger" onclick="window.__deleteHistory('${item.id}')" title="Delete">🗑️</button>
        </div>
      </div>
    `).join('');
  }

  function loadHistoryItem(id) {
    const list = readHistory();
    const item = list.find(h => h.id === id);
    if (!item) {
      showToast('History item not found', 'error');
      return;
    }

    // Restore config
    state = { ...deepClone(DEFAULT_STATE), ...item.config };
    moduleEnabled = { ...deepClone(DEFAULT_MODULE_ENABLED), ...item.moduleEnabled };
    normalizeStateForReliability();

    // Restore game to iframe — detect multi-file vs single-file
    // Backward compat: old entries have no outputMode/files fields → treat as single-file
    const isMulti = (item.outputMode === 'multi') || (item.files && Array.isArray(item.files) && item.files.length > 0);

    if (isMulti && item.files) {
      renderMultiFileInIframe(item.files);
    } else if (item.code) {
      renderInIframe(item.code);
    }

    // Update UI fields
    syncUIFromState();
    updatePromptPreview();
    saveState();

    closeModal('modal-history');
    showToast('Loaded: ' + item.title, 'success');
  }

  function deleteHistoryItem(id) {
    let list = readHistory();
    list = list.filter(h => h.id !== id);
    writeHistory(list);
    renderHistory();
    showToast('History item deleted', 'info');
  }

  function clearHistory() {
    if (!confirm('Delete all generation history? This cannot be undone.')) return;
    writeHistory([]);
    renderHistory();
    showToast('History cleared', 'info');
  }

  // ═══════════════════════════════════════════════
  // DOWNLOAD
  // ═══════════════════════════════════════════════

  // Dispatcher: routes to single-file or ZIP download based on output mode
  function downloadGame() {
    if (state.outputMode === 'multi') {
      downloadZIP();
    } else {
      downloadHTML();
    }
  }

  function downloadHTML() {
    if (!lastGeneratedCode) {
      showToast('No game to download. Generate one first!', 'warning');
      return;
    }

    const blob = new Blob([lastGeneratedCode], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const genre = state.coreIdentity.genre || 'game';
    const theme = state.coreIdentity.theme || 'untitled';
    a.download = `${genre.toLowerCase()}-${theme.toLowerCase().replace(/\s+/g, '-')}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('Game downloaded! 💾', 'success');
  }

  // Download multi-file game as ZIP
  async function downloadZIP() {
    if (!lastGeneratedFiles || lastGeneratedFiles.length === 0) {
      showToast('No files to download. Generate a multi-file game first!', 'warning');
      return;
    }

    const genre = state.coreIdentity.genre || 'game';
    const theme = state.coreIdentity.theme || 'untitled';
    const zipName = `${genre.toLowerCase()}-${theme.toLowerCase().replace(/\s+/g, '-')}.zip`;

    try {
      // Dynamically load JSZip if not already loaded
      if (typeof JSZip === 'undefined') {
        showToast('Loading ZIP library...', 'info');
        await loadJSZip();
      }

      const zip = new JSZip();

      // Add each file to the ZIP, preserving folder structure
      lastGeneratedFiles.forEach(file => {
        zip.file(file.path, file.content);
      });

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = zipName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast('Game downloaded as ZIP! 💾', 'success');
    } catch (err) {
      console.error('ZIP download failed:', err);
      showToast('ZIP download failed: ' + err.message, 'error', 5000);
    }
  }

  // Dynamically load JSZip from CDN
  function loadJSZip() {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load JSZip library from CDN'));
      document.head.appendChild(script);
    });
  }

  // ═══════════════════════════════════════════════
  // UI SYNC
  // ═══════════════════════════════════════════════

  function syncUIFromState() {
    // Sync all data-path fields (skip radios — handled separately)
    document.querySelectorAll('[data-path]').forEach(el => {
      if (el.type === 'radio') return; // radios handled separately
      const path = el.dataset.path;
      const value = getNestedValue(state, path);
      if (value === undefined || value === null) return;

      if (el.type === 'checkbox') {
        el.checked = !!value;
      } else {
        el.value = value;
      }
    });

    // Sync module toggles
    document.querySelectorAll('.module-toggle').forEach(cb => {
      cb.checked = !!moduleEnabled[cb.dataset.moduleKey];
    });

    // Sync output mode radio buttons
    document.querySelectorAll('input[name="outputMode"]').forEach(radio => {
      radio.checked = (radio.value === (state.outputMode || 'single'));
    });

    // Show/hide Files tab based on output mode
    const filesTab = document.getElementById('tab-files');
    if (filesTab) {
      filesTab.style.display = (state.outputMode === 'multi') ? '' : 'none';
    }

    // Update download button label
    const btnDownload = document.getElementById('btn-download');
    if (btnDownload) {
      btnDownload.textContent = (state.outputMode === 'multi') ? '💾 Download ZIP' : '💾 Download';
      btnDownload.title = (state.outputMode === 'multi') ? 'Download all files as ZIP' : 'Download HTML file';
    }

    // Sync mechanics tags
    document.querySelectorAll('#mechanics-tags .tag-btn').forEach(btn => {
      const isActive = state.mechanics.tags.includes(btn.dataset.value);
      btn.classList.toggle('active', isActive);
    });

    // Sync game menu tags
    document.querySelectorAll('#menuOptions-tags .tag-btn').forEach(btn => {
      const isActive = (state.gameMenu.menuOptions || []).includes(btn.dataset.value);
      btn.classList.toggle('active', isActive);
    });
    document.querySelectorAll('#hudElements-tags .tag-btn').forEach(btn => {
      const isActive = (state.gameMenu.hudElements || []).includes(btn.dataset.value);
      btn.classList.toggle('active', isActive);
    });
    document.querySelectorAll('#gameActions-tags .tag-btn').forEach(btn => {
      const isActive = (state.gameMenu.gameActions || []).includes(btn.dataset.value);
      btn.classList.toggle('active', isActive);
    });

    // Update derived labels
    updateToneLabel();
    updateTempLabel();
  }

  function syncStateFromUI() {
    // Sync all data-path fields (skip radios — handled separately)
    document.querySelectorAll('[data-path]').forEach(el => {
      if (el.type === 'radio') return; // radios handled separately
      const path = el.dataset.path;
      if (!path) return;

      let value;
      if (el.type === 'checkbox') {
        value = el.checked;
      } else if (el.type === 'number' || el.type === 'range') {
        value = parseFloat(el.value);
      } else if (el.type === 'color') {
        value = el.value;
      } else {
        value = el.value;
      }

      setNestedValue(state, path, value);
    });

    // Sync module toggles
    document.querySelectorAll('.module-toggle').forEach(cb => {
      moduleEnabled[cb.dataset.moduleKey] = cb.checked;
    });

    // Sync output mode
    const checkedOutput = document.querySelector('input[name="outputMode"]:checked');
    if (checkedOutput) {
      state.outputMode = checkedOutput.value;
    }

    // Sync mechanics tags
    state.mechanics.tags = [];
    document.querySelectorAll('#mechanics-tags .tag-btn.active').forEach(btn => {
      state.mechanics.tags.push(btn.dataset.value);
    });

    // Sync game menu tags
    state.gameMenu.menuOptions = [];
    document.querySelectorAll('#menuOptions-tags .tag-btn.active').forEach(btn => {
      state.gameMenu.menuOptions.push(btn.dataset.value);
    });
    state.gameMenu.hudElements = [];
    document.querySelectorAll('#hudElements-tags .tag-btn.active').forEach(btn => {
      state.gameMenu.hudElements.push(btn.dataset.value);
    });
    state.gameMenu.gameActions = [];
    document.querySelectorAll('#gameActions-tags .tag-btn.active').forEach(btn => {
      state.gameMenu.gameActions.push(btn.dataset.value);
    });
  }

  function updatePromptPreview() {
    const preview = document.getElementById('prompt-preview');
    if (promptLocked) {
      // Auto-generated: always refresh from modules
      preview.textContent = getFullPromptText();
      preview.contentEditable = 'false';
    } else {
      // Unlocked: show custom text (or default if not yet edited)
      if (!customPromptText) {
        const { systemPrompt, userPrompt } = assemblePrompt();
        customPromptText = `=== SYSTEM PROMPT ===\n${systemPrompt}\n\n=== USER PROMPT ===\n${userPrompt}`;
      }
      preview.textContent = customPromptText;
      preview.contentEditable = 'true';
    }
  }

  function updateToneLabel() {
    const val = state.coreIdentity.tone;
    const label = val <= 20 ? 'Very Dark/Gritty'
      : val <= 40 ? 'Dark'
      : val <= 60 ? 'Balanced'
      : val <= 80 ? 'Bright' : 'Very Bright/Whimsical';
    document.getElementById('tone-label').textContent = label;
  }

  function updateTempLabel() {
    const label = document.getElementById('temp-label');
    if (label) {
      label.textContent = apiSettings.temperature;
    }
  }

  // ═══════════════════════════════════════════════
  // TAB SWITCHING
  // ═══════════════════════════════════════════════

  function switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    document.querySelectorAll('.tab-panel').forEach(panel => {
      panel.classList.toggle('active', panel.id === `panel-${tabName}`);
    });
  }

  // ═══════════════════════════════════════════════
  // MODALS
  // ═══════════════════════════════════════════════

  function openModal(id) {
    const modal = document.getElementById(id);
    if (modal && modal.showModal) {
      modal.showModal();
    }
  }

  function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal && modal.close) {
      modal.close();
    }
  }

  // ═══════════════════════════════════════════════
  // HTML ESCAPE
  // ═══════════════════════════════════════════════

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ═══════════════════════════════════════════════
  // FULLSCREEN IFRAME
  // ═══════════════════════════════════════════════

  function toggleFullscreen() {
    const container = document.getElementById('iframe-container');
    const isFs = container.classList.toggle('fullscreen');

    if (isFs) {
      // Add exit button
      const exitBtn = document.createElement('button');
      exitBtn.className = 'fullscreen-exit';
      exitBtn.textContent = '✕ Exit Fullscreen';
      exitBtn.onclick = toggleFullscreen;
      container.appendChild(exitBtn);
    } else {
      // Remove exit button
      const exitBtn = container.querySelector('.fullscreen-exit');
      if (exitBtn) exitBtn.remove();
    }
  }

  // ═══════════════════════════════════════════════
  // COPY PROMPT
  // ═══════════════════════════════════════════════

  async function copyPrompt() {
    const text = getFullPromptText();
    try {
      await navigator.clipboard.writeText(text);
      showToast('Prompt copied to clipboard! 📋', 'success');
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      showToast('Prompt copied! 📋', 'success');
    }
  }

  // ═══════════════════════════════════════════════
  // EVENT LISTENERS
  // ═══════════════════════════════════════════════

  function initEventListeners() {
    // ── Generate Button ──
    document.getElementById('btn-generate').addEventListener('click', generateGame);

    // ── Refine Button ──
    document.getElementById('btn-refine').addEventListener('click', () => {
      const input = document.getElementById('refine-input');
      if (input.value.trim()) refineGame(input.value.trim());
    });

    // ── Refine Enter Key ──
    document.getElementById('refine-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const val = e.target.value.trim();
        if (val) refineGame(val);
      }
    });

    // ── Genre change: auto-apply genre defaults ──
    const genreSelect = document.getElementById('genre');
    if (genreSelect) {
      genreSelect.addEventListener('change', () => {
        const selectedGenre = genreSelect.value;
        if (selectedGenre) {
          applyGenreDefaults(selectedGenre);
        }
      });
    }

    // ── All data-path fields: auto-save on change ──
    document.querySelectorAll('[data-path]').forEach(el => {
      const eventType = (el.type === 'range' || el.type === 'color') ? 'input' : 'change';
      el.addEventListener(eventType, () => {
        syncStateFromUI();
        updatePromptPreview();
        updateToneLabel();
        saveState();
        displayConflicts();
      });
    });

    // ── Module toggles ──
    document.querySelectorAll('.module-toggle').forEach(cb => {
      cb.addEventListener('change', () => {
        moduleEnabled[cb.dataset.moduleKey] = cb.checked;
        updatePromptPreview();
        saveState();
      });
    });

    // ── Output mode radio buttons ──
    document.querySelectorAll('input[name="outputMode"]').forEach(radio => {
      radio.addEventListener('change', () => {
        syncStateFromUI();
        syncUIFromState(); // refresh tab visibility + download label
        updatePromptPreview();
        saveState();
      });
    });

    // ── Download ZIP button (Files panel) ──
    const btnDownloadZip = document.getElementById('btn-download-zip');
    if (btnDownloadZip) {
      btnDownloadZip.addEventListener('click', downloadGame);
    }

    // ── Clear Live View button ──
    const btnClearLiveView = document.getElementById('btn-clear-liveview');
    if (btnClearLiveView) {
      btnClearLiveView.addEventListener('click', liveViewClear);
    }

    // ── Mechanics tags ──
    document.querySelectorAll('#mechanics-tags .tag-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        btn.classList.toggle('active');
        syncStateFromUI();
        updatePromptPreview();
        saveState();
      });
    });

    // ── Game Menu: Menu Options tags ──
    document.querySelectorAll('#menuOptions-tags .tag-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        btn.classList.toggle('active');
        syncStateFromUI();
        updatePromptPreview();
        saveState();
      });
    });

    // ── Game Menu: HUD Elements tags ──
    document.querySelectorAll('#hudElements-tags .tag-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        btn.classList.toggle('active');
        syncStateFromUI();
        updatePromptPreview();
        saveState();
      });
    });

    // ── Game Menu: Game Actions tags ──
    document.querySelectorAll('#gameActions-tags .tag-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        btn.classList.toggle('active');
        syncStateFromUI();
        updatePromptPreview();
        saveState();
      });
    });

    // ── Tab switching ──
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // ── Sidebar toggle ──
    document.getElementById('btn-toggle-sidebar').addEventListener('click', () => {
      document.getElementById('sidebar').classList.toggle('collapsed');
    });

    // ── Settings modal ──
    document.getElementById('btn-settings').addEventListener('click', () => {
      // Populate settings fields from apiSettings
      document.getElementById('apiBaseUrl').value = apiSettings.baseUrl;
      document.getElementById('apiKey').value = apiSettings.key;
      document.getElementById('modelName').value = apiSettings.model;
      document.getElementById('apiTemperature').value = apiSettings.temperature;
      updateTempLabel();

      // Highlight matching provider preset
      let matchedProvider = false;
      document.querySelectorAll('.provider-btn').forEach(btn => {
        const preset = PROVIDER_PRESETS[btn.dataset.provider];
        if (preset && preset.baseUrl && apiSettings.baseUrl === preset.baseUrl) {
          btn.classList.add('active');
          matchedProvider = true;
          // Populate model dropdown for this provider
          const modelSelect = document.getElementById('modelPreset');
          modelSelect.innerHTML = '<option value="">— Quick Select —</option>';
          preset.models.forEach(model => {
            const opt = document.createElement('option');
            opt.value = model;
            opt.textContent = model;
            modelSelect.appendChild(opt);
          });
        } else {
          btn.classList.remove('active');
        }
      });
      // If no preset matched and there's a custom URL, highlight Custom API
      if (!matchedProvider && apiSettings.baseUrl) {
        const customBtn = document.querySelector('.provider-btn[data-provider="custom"]');
        if (customBtn) customBtn.classList.add('active');
      }

      openModal('modal-settings');
    });

    // ── Save settings on close ──
    document.getElementById('modal-settings').addEventListener('close', () => {
      apiSettings.baseUrl = document.getElementById('apiBaseUrl').value.trim();
      apiSettings.key = document.getElementById('apiKey').value.trim();
      apiSettings.model = document.getElementById('modelName').value.trim();
      apiSettings.temperature = parseFloat(document.getElementById('apiTemperature').value) || 0.7;
      // Save active provider
      const activeProvider = document.querySelector('.provider-btn.active');
      apiSettings.provider = activeProvider ? activeProvider.dataset.provider : '';
      saveApiSettings();
    });

    // ── Temperature slider live update ──
    document.getElementById('apiTemperature').addEventListener('input', (e) => {
      document.getElementById('temp-label').textContent = e.target.value;
    });

    // ── Provider preset buttons ──
    document.querySelectorAll('.provider-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const provider = btn.dataset.provider;
        const preset = PROVIDER_PRESETS[provider];
        if (!preset) return;

        // Highlight active provider
        document.querySelectorAll('.provider-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Fill in base URL (clear for custom — user enters their own)
        if (provider === 'custom') {
          document.getElementById('apiBaseUrl').value = '';
          document.getElementById('apiBaseUrl').placeholder = 'https://your-api-endpoint.com/v1';
        } else {
          document.getElementById('apiBaseUrl').value = preset.baseUrl;
        }

        // Fill in default model (clear for custom)
        if (provider === 'custom') {
          document.getElementById('modelName').value = '';
          document.getElementById('modelName').placeholder = 'Enter your model name';
        } else {
          document.getElementById('modelName').value = preset.defaultModel;
        }

        // Populate model quick-select dropdown
        const modelSelect = document.getElementById('modelPreset');
        modelSelect.innerHTML = '<option value="">— Quick Select —</option>';
        preset.models.forEach(model => {
          const opt = document.createElement('option');
          opt.value = model;
          opt.textContent = model;
          modelSelect.appendChild(opt);
        });

        // Clear API key for local providers
        if (!preset.needsKey) {
          document.getElementById('apiKey').value = '';
          document.getElementById('apiKey').placeholder = 'Not required for local LLMs';
        } else if (provider === 'custom') {
          document.getElementById('apiKey').placeholder = 'Enter your API key (if required)';
        } else {
          document.getElementById('apiKey').placeholder = 'sk-... (enter your API key)';
        }

        // Update temperature label
        updateTempLabel();

        // Clear previous status messages
        document.getElementById('connection-status').textContent = '';
        document.getElementById('connection-status').className = 'connection-status';
        document.getElementById('model-fetch-status').textContent = '';
        document.getElementById('model-fetch-status').className = 'model-fetch-status';

        // Auto-fetch models for local providers (Ollama, LM Studio)
        if (provider === 'ollama' || provider === 'lmstudio') {
          autoFetchModels();
        }
      });
    });

    // ── Model quick-select dropdown ──
    document.getElementById('modelPreset').addEventListener('change', (e) => {
      if (e.target.value) {
        document.getElementById('modelName').value = e.target.value;
      }
    });

    // ── Fetch Models button ──
    document.getElementById('btn-fetch-models').addEventListener('click', autoFetchModels);

    // ── Test Connection button ──
    document.getElementById('btn-test-connection').addEventListener('click', testApiConnection);

    // ── History modal ──
    document.getElementById('btn-history').addEventListener('click', () => {
      renderHistory();
      openModal('modal-history');
    });

    // ── Clear history ──
    document.getElementById('btn-clear-history').addEventListener('click', clearHistory);

    // ── Download HTML / ZIP ──
    document.getElementById('btn-download').addEventListener('click', downloadGame);

    // ── Fullscreen ──
    document.getElementById('btn-fullscreen').addEventListener('click', toggleFullscreen);

    // ── Refresh iframe ──
    document.getElementById('btn-refresh-iframe').addEventListener('click', () => {
      if (state.outputMode === 'multi' && lastGeneratedFiles) {
        renderMultiFileInIframe(lastGeneratedFiles);
        showToast('Game refreshed', 'info');
      } else if (lastGeneratedCode) {
        renderInIframe(lastGeneratedCode);
        showToast('Game refreshed', 'info');
      }
    });

    // ── Dismiss error panel ──
    const btnDismissError = document.getElementById('btn-dismiss-error');
    if (btnDismissError) {
      btnDismissError.addEventListener('click', hideErrorPanel);
    }

    // ── Copy prompt ──
    document.getElementById('btn-copy-prompt').addEventListener('click', copyPrompt);

    // ── Lock/Unlock prompt ──
    document.getElementById('btn-lock-prompt').addEventListener('click', () => {
      const btn = document.getElementById('btn-lock-prompt');
      const preview = document.getElementById('prompt-preview');
      const warning = document.getElementById('prompt-edit-warning');
      const resetBtn = document.getElementById('btn-reset-prompt');

      if (promptLocked) {
        // Unlock: save current auto-generated text as starting point for editing
        const { systemPrompt, userPrompt } = assemblePrompt();
        customPromptText = `=== SYSTEM PROMPT ===\n${systemPrompt}\n\n=== USER PROMPT ===\n${userPrompt}`;
        promptLocked = false;
        btn.textContent = '🔓 Unlocked';
        btn.classList.remove('locked');
        btn.classList.add('unlocked');
        preview.classList.remove('prompt-locked');
        preview.classList.add('prompt-unlocked');
        preview.contentEditable = 'true';
        preview.textContent = customPromptText;
        warning.classList.remove('hidden');
        resetBtn.disabled = false;
        showToast('Prompt unlocked — edits will affect generation results', 'warning');
      } else {
        // Lock: save current edited text and lock
        customPromptText = preview.textContent;
        promptLocked = true;
        btn.textContent = '🔒 Locked';
        btn.classList.remove('unlocked');
        btn.classList.add('locked');
        preview.classList.remove('prompt-unlocked');
        preview.classList.add('prompt-locked');
        preview.contentEditable = 'false';
        warning.classList.add('hidden');
        resetBtn.disabled = true;
        showToast('Prompt locked — using your edited version', 'info');
      }
      saveState();
    });

    // ── Save prompt edits on input ──
    document.getElementById('prompt-preview').addEventListener('input', () => {
      if (!promptLocked) {
        customPromptText = document.getElementById('prompt-preview').textContent;
        saveState();
      }
    });

    // ── Reset prompt to default ──
    document.getElementById('btn-reset-prompt').addEventListener('click', () => {
      if (promptLocked) return;
      customPromptText = '';
      const { systemPrompt, userPrompt } = assemblePrompt();
      const defaultText = `=== SYSTEM PROMPT ===\n${systemPrompt}\n\n=== USER PROMPT ===\n${userPrompt}`;
      document.getElementById('prompt-preview').textContent = defaultText;
      customPromptText = defaultText;
      saveState();
      showToast('Prompt reset to auto-generated default', 'success');
    });

    // ── Modal close buttons ──
    document.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', () => closeModal(btn.dataset.close));
    });

    // ── Close modals on backdrop click ──
    document.querySelectorAll('.modal').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.close();
      });
    });

    // ── Module scroll buttons ──
    document.querySelectorAll('.module-scroll-top').forEach(btn => {
      btn.addEventListener('click', () => {
        const body = btn.closest('.module-body');
        if (body) body.scrollBy({ top: -100, behavior: 'smooth' });
      });
    });
    document.querySelectorAll('.module-scroll-bottom').forEach(btn => {
      btn.addEventListener('click', () => {
        const body = btn.closest('.module-body');
        if (body) body.scrollBy({ top: 100, behavior: 'smooth' });
      });
    });

    // ── Keyboard shortcuts ──
    document.addEventListener('keydown', (e) => {
      // Ctrl+Enter: Generate
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        generateGame();
      }
      // Ctrl+B: Toggle sidebar
      if (e.ctrlKey && e.key === 'b') {
        e.preventDefault();
        document.getElementById('sidebar').classList.toggle('collapsed');
      }
      // Ctrl+H: History
      if (e.ctrlKey && e.key === 'h') {
        e.preventDefault();
        renderHistory();
        openModal('modal-history');
      }
      // Ctrl+,: Settings
      if (e.ctrlKey && e.key === ',') {
        e.preventDefault();
        document.getElementById('btn-settings').click();
      }
      // Escape: Close modals or fullscreen
      if (e.key === 'Escape') {
        const fsContainer = document.getElementById('iframe-container');
        if (fsContainer.classList.contains('fullscreen')) {
          toggleFullscreen();
        }
      }
    });
  }

  // ═══════════════════════════════════════════════
  // GLOBAL EXPOSES (for inline onclick in history)
  // ═══════════════════════════════════════════════

  window.__loadHistory = loadHistoryItem;
  window.__deleteHistory = deleteHistoryItem;

  // ═══════════════════════════════════════════════
  // RESTORE PROMPT LOCK UI STATE
  // ═══════════════════════════════════════════════

  function restorePromptLockUI() {
    const btn = document.getElementById('btn-lock-prompt');
    const preview = document.getElementById('prompt-preview');
    const warning = document.getElementById('prompt-edit-warning');
    const resetBtn = document.getElementById('btn-reset-prompt');
    if (!btn || !preview) return;

    if (!promptLocked) {
      // Unlocked state — restore editable mode
      btn.textContent = '🔓 Unlocked';
      btn.classList.remove('locked');
      btn.classList.add('unlocked');
      preview.classList.remove('prompt-locked');
      preview.classList.add('prompt-unlocked');
      preview.contentEditable = 'true';
      if (customPromptText) {
        preview.textContent = customPromptText;
      }
      if (warning) warning.classList.remove('hidden');
      if (resetBtn) resetBtn.disabled = false;
    } else {
      // Locked state — read-only
      btn.textContent = '🔒 Locked';
      btn.classList.add('locked');
      btn.classList.remove('unlocked');
      preview.classList.add('prompt-locked');
      preview.classList.remove('prompt-unlocked');
      preview.contentEditable = 'false';
      if (warning) warning.classList.add('hidden');
      if (resetBtn) resetBtn.disabled = true;
    }
  }

  // ═══════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════

  function init() {
    // Load persisted state
    loadState();
    loadApiSettings();

    // Sync UI from loaded state
    syncUIFromState();

    // Build initial prompt preview
    updatePromptPreview();

    // Restore prompt lock UI state from persisted state
    restorePromptLockUI();

    // Set up all event listeners
    initEventListeners();

    // Check for conflicts
    displayConflicts();

    console.log('🎮 Game Creator initialized');
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
