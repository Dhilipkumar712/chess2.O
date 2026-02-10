/* ============================================
   APP.JS — Main application controller
   Page routing, board rendering, game flow,
   theme toggle, modals, chat, timers, bot.
   ============================================ */

// ========== GLOBAL STATE ==========
let gameState = null;
let gameMode = null;       // 'player' or 'bot'
let botDifficulty = null;  // 'beginner', 'medium', 'pro'
let selectedSquare = null; // { r, c }
let legalMovesForSelected = [];
let lastMove = null;       // { fromR, fromC, toR, toC }
let whiteTime = 600;       // seconds
let blackTime = 600;
let timerInterval = null;
let isBotThinking = false;
let pendingPromotion = null; // { move }

// ========== LOADING SCREEN ==========
window.addEventListener('load', () => {
  setTimeout(() => {
    const loader = document.getElementById('loading-screen');
    loader.classList.add('fade-out');
    setTimeout(() => { loader.style.display = 'none'; }, 600);
  }, 2200);
});

// ========== THEME TOGGLE ==========
function toggleTheme() {
  const html = document.documentElement;
  const current = html.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  document.getElementById('theme-icon').textContent = next === 'dark' ? '🌙' : '☀️';
  localStorage.setItem('chess-theme', next);
}

// Load saved theme
(function initTheme() {
  const saved = localStorage.getItem('chess-theme');
  if (saved) {
    document.documentElement.setAttribute('data-theme', saved);
    const icon = document.getElementById('theme-icon');
    if (icon) icon.textContent = saved === 'dark' ? '🌙' : '☀️';
  }
})();

// ========== PAGE NAVIGATION ==========
function showPage(pageName) {
  // Hide all pages
  document.querySelectorAll('.page').forEach(p => {
    p.classList.remove('page-active');
  });

  // Show target page
  const target = document.getElementById('page-' + pageName);
  if (target) {
    target.classList.remove('page-active');
    // Force reflow for animation
    void target.offsetWidth;
    target.classList.add('page-active');
  }

  // Update nav links
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.remove('active');
    if (link.getAttribute('data-page') === pageName) {
      link.classList.add('active');
    }
  });

  // Close mobile menu
  document.getElementById('nav-links')?.classList.remove('open');
  document.getElementById('hamburger')?.classList.remove('open');

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ========== MOBILE MENU ==========
function toggleMobileMenu() {
  document.getElementById('nav-links').classList.toggle('open');
  document.getElementById('hamburger').classList.toggle('open');
}

// ========== MODALS ==========
function openModal(id) {
  document.getElementById(id)?.classList.add('show');
}
function closeModal(id) {
  document.getElementById(id)?.classList.remove('show');
}
function switchModal(fromId, toId) {
  closeModal(fromId);
  setTimeout(() => openModal(toId), 200);
}

// Close modals on overlay click
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay') && e.target.classList.contains('show')) {
    e.target.classList.remove('show');
  }
});

// ========== AUTH HANDLERS (placeholder) ==========
function handleLogin(e) {
  e.preventDefault();
  showToast('Logged in successfully!');
  closeModal('login-modal');
}
function handleSignup(e) {
  e.preventDefault();
  showToast('Account created! Welcome to ChessMaster.');
  closeModal('signup-modal');
}

// ========== TOAST ==========
function showToast(msg) {
  const toast = document.getElementById('toast');
  document.getElementById('toast-msg').textContent = msg;
  toast.classList.remove('hidden');
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.classList.add('hidden'), 300);
  }, 3000);
}

// ========== GAME SETUP ==========
function selectOpponent(type) {
  gameMode = type;

  // Update cards
  document.getElementById('setup-vs-player').classList.toggle('active', type === 'player');
  document.getElementById('setup-vs-bot').classList.toggle('active', type === 'bot');

  // Show/hide difficulty
  const diffSection = document.getElementById('difficulty-section');
  const actionsSection = document.getElementById('setup-actions');

  if (type === 'bot') {
    diffSection.classList.remove('hidden');
    botDifficulty = null;
    document.querySelectorAll('.diff-card').forEach(c => c.classList.remove('active'));
    actionsSection.classList.add('hidden');
  } else {
    diffSection.classList.add('hidden');
    botDifficulty = null;
    actionsSection.classList.remove('hidden');
  }
}

function selectDifficulty(level) {
  botDifficulty = level;
  document.querySelectorAll('.diff-card').forEach(c => {
    c.classList.toggle('active', c.getAttribute('data-level') === level);
  });
  document.getElementById('setup-actions').classList.remove('hidden');
}

// ========== START GAME ==========
function startGame() {
  if (!gameMode) { showToast('Please select an opponent type.'); return; }
  if (gameMode === 'bot' && !botDifficulty) { showToast('Please select a difficulty level.'); return; }

  // Init engine
  gameState = ChessEngine.createGameState();
  selectedSquare = null;
  legalMovesForSelected = [];
  lastMove = null;
  whiteTime = 600;
  blackTime = 600;
  isBotThinking = false;
  pendingPromotion = null;

  // Update player names
  document.getElementById('white-name').textContent = 'You (White)';
  document.getElementById('black-name').textContent =
    gameMode === 'bot'
      ? `Bot (${botDifficulty.charAt(0).toUpperCase() + botDifficulty.slice(1)})`
      : 'Player 2 (Black)';

  // Show board, hide setup
  document.getElementById('game-setup').classList.add('hidden');
  document.getElementById('game-container').classList.remove('hidden');

  renderBoard();
  updateTurnIndicator();
  updateCaptured();
  clearMoveHistory();
  startTimer();
}

// ========== RENDER BOARD ==========
function renderBoard() {
  const boardEl = document.getElementById('chess-board');
  boardEl.innerHTML = '';

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const sq = document.createElement('div');
      const isLight = (r + c) % 2 === 0;
      sq.className = `square ${isLight ? 'square-light' : 'square-dark'}`;
      sq.dataset.row = r;
      sq.dataset.col = c;

      // Last move highlight
      if (lastMove &&
        ((r === lastMove.fromR && c === lastMove.fromC) ||
         (r === lastMove.toR && c === lastMove.toC))) {
        sq.classList.add('last-move');
      }

      // Selected highlight
      if (selectedSquare && selectedSquare.r === r && selectedSquare.c === c) {
        sq.classList.add('selected');
      }

      // Legal move dots
      const isLegal = legalMovesForSelected.find(m => m.toR === r && m.toC === c);
      if (isLegal) {
        if (gameState.board[r][c] !== ChessEngine.EMPTY || isLegal.enPassant) {
          sq.classList.add('legal-capture');
        } else {
          sq.classList.add('legal-move');
        }
      }

      // Check highlight
      const king = ChessEngine.findKing(gameState.board, gameState.turn);
      if (king && king.r === r && king.c === c && ChessEngine.isInCheck(gameState.board, gameState.turn)) {
        sq.classList.add('in-check');
      }

      // Piece
      const piece = gameState.board[r][c];
      if (piece) {
        const pieceEl = document.createElement('span');
        pieceEl.className = 'piece';
        pieceEl.textContent = ChessEngine.PIECE_UNICODE[piece];
        sq.appendChild(pieceEl);
      }

      sq.addEventListener('click', () => handleSquareClick(r, c));
      boardEl.appendChild(sq);
    }
  }
}

// ========== HANDLE SQUARE CLICK ==========
function handleSquareClick(r, c) {
  if (gameState.isGameOver || isBotThinking || pendingPromotion) return;

  const piece = gameState.board[r][c];

  // If a piece is already selected
  if (selectedSquare) {
    // Check if clicking on a legal move target
    const move = legalMovesForSelected.find(m => m.toR === r && m.toC === c);
    if (move) {
      // Handle promotion
      if (move.promotion) {
        showPromotionModal(move);
        return;
      }
      executeMove(move);
      return;
    }

    // Clicking own piece — reselect
    if (piece && ChessEngine.isAlly(piece, gameState.turn)) {
      selectPiece(r, c);
      return;
    }

    // Deselect
    deselectPiece();
    return;
  }

  // No piece selected yet — select own piece
  if (piece && ChessEngine.isAlly(piece, gameState.turn)) {
    // In bot mode, only allow selecting white pieces (human always plays white)
    if (gameMode === 'bot' && gameState.turn === 'b') return;
    selectPiece(r, c);
  }
}

function selectPiece(r, c) {
  selectedSquare = { r, c };
  legalMovesForSelected = ChessEngine.getLegalMoves(gameState, r, c);
  renderBoard();
}

function deselectPiece() {
  selectedSquare = null;
  legalMovesForSelected = [];
  renderBoard();
}

// ========== PROMOTION ==========
function showPromotionModal(move) {
  pendingPromotion = move;
  const turn = gameState.turn;
  const pieces = turn === 'w'
    ? [ChessEngine.WQ, ChessEngine.WR, ChessEngine.WB, ChessEngine.WN]
    : [ChessEngine.BQ, ChessEngine.BR, ChessEngine.BB, ChessEngine.BN];

  const container = document.getElementById('promotion-choices');
  container.innerHTML = '';

  pieces.forEach(p => {
    const btn = document.createElement('button');
    btn.className = 'promotion-choice';
    btn.textContent = ChessEngine.PIECE_UNICODE[p];
    btn.addEventListener('click', () => {
      pendingPromotion.promotionPiece = p;
      closeModal('promotion-modal');
      executeMove(pendingPromotion);
      pendingPromotion = null;
    });
    container.appendChild(btn);
  });

  openModal('promotion-modal');
}

// ========== EXECUTE MOVE ==========
function executeMove(move) {
  const result = ChessEngine.makeMove(gameState, move);

  lastMove = { fromR: move.fromR, fromC: move.fromC, toR: move.toR, toC: move.toC };
  selectedSquare = null;
  legalMovesForSelected = [];

  renderBoard();
  updateTurnIndicator();
  updateCaptured();
  addMoveToHistory(result.notation);

  // Animate the piece
  const toSquare = document.querySelector(`.square[data-row="${move.toR}"][data-col="${move.toC}"] .piece`);
  if (toSquare) {
    toSquare.classList.add(result.captured ? 'capture-anim' : 'drop-anim');
    setTimeout(() => toSquare.classList.remove('capture-anim', 'drop-anim'), 250);
  }

  if (result.isGameOver) {
    stopTimer();
    showGameOverModal(result.result);
    return;
  }

  // Bot's turn
  if (gameMode === 'bot' && gameState.turn === 'b') {
    isBotThinking = true;
    const delay = botDifficulty === 'beginner' ? 300 : botDifficulty === 'medium' ? 500 : 200;
    if (botDifficulty === 'pro') showToast('🤖 Bot is thinking deeply…');
    setTimeout(() => {
      makeBotMove();
    }, delay);
  }
}

// ========== BOT MOVE ==========
function makeBotMove() {
  if (gameState.isGameOver) { isBotThinking = false; return; }

  const move = ChessBot.getBotMove(gameState, botDifficulty);
  if (!move) { isBotThinking = false; return; }

  const result = ChessEngine.makeMove(gameState, move);

  lastMove = { fromR: move.fromR, fromC: move.fromC, toR: move.toR, toC: move.toC };
  selectedSquare = null;
  legalMovesForSelected = [];

  renderBoard();
  updateTurnIndicator();
  updateCaptured();
  addMoveToHistory(result.notation);

  const toSquare = document.querySelector(`.square[data-row="${move.toR}"][data-col="${move.toC}"] .piece`);
  if (toSquare) {
    toSquare.classList.add(result.captured ? 'capture-anim' : 'drop-anim');
    setTimeout(() => toSquare.classList.remove('capture-anim', 'drop-anim'), 250);
  }

  isBotThinking = false;

  if (result.isGameOver) {
    stopTimer();
    showGameOverModal(result.result);
  }
}

// ========== TURN INDICATOR ==========
function updateTurnIndicator() {
  const whiteInfo = document.getElementById('player-white-info');
  const blackInfo = document.getElementById('player-black-info');
  whiteInfo.classList.toggle('active-turn', gameState.turn === 'w');
  blackInfo.classList.toggle('active-turn', gameState.turn === 'b');
}

// ========== CAPTURED PIECES ==========
function updateCaptured() {
  // Black captured = pieces taken from white (shown near black player)
  const blackCapturedEl = document.getElementById('black-captured');
  const whiteCapturedEl = document.getElementById('white-captured');

  blackCapturedEl.textContent = gameState.capturedWhite
    .sort((a, b) => (ChessEngine.PIECE_VALUES[b] || 0) - (ChessEngine.PIECE_VALUES[a] || 0))
    .map(p => ChessEngine.PIECE_UNICODE[p])
    .join('');

  whiteCapturedEl.textContent = gameState.capturedBlack
    .sort((a, b) => (ChessEngine.PIECE_VALUES[b] || 0) - (ChessEngine.PIECE_VALUES[a] || 0))
    .map(p => ChessEngine.PIECE_UNICODE[p])
    .join('');
}

// ========== MOVE HISTORY ==========
function clearMoveHistory() {
  document.getElementById('moves-list').innerHTML = '';
}

function addMoveToHistory(notation) {
  const list = document.getElementById('moves-list');
  const moveCount = gameState.moveList.length;
  const isWhiteMove = moveCount % 2 === 1; // just played was white if moveList length is odd

  if (isWhiteMove) {
    // New move pair
    const entry = document.createElement('span');
    entry.className = 'move-entry';
    const num = document.createElement('span');
    num.className = 'move-number';
    num.textContent = Math.ceil(moveCount / 2) + '.';
    const white = document.createElement('span');
    white.className = 'move-notation';
    white.textContent = notation;
    entry.appendChild(num);
    entry.appendChild(white);
    list.appendChild(entry);
  } else {
    // Add black move to last entry
    const entries = list.querySelectorAll('.move-entry');
    const lastEntry = entries[entries.length - 1];
    if (lastEntry) {
      const black = document.createElement('span');
      black.className = 'move-notation';
      black.textContent = notation;
      lastEntry.appendChild(black);
    }
  }

  // Scroll to bottom
  const historyEl = document.getElementById('move-history');
  historyEl.scrollTop = historyEl.scrollHeight;
}

// ========== TIMER ==========
function startTimer() {
  stopTimer();
  timerInterval = setInterval(() => {
    if (gameState.isGameOver || isBotThinking) return;

    if (gameState.turn === 'w') {
      whiteTime--;
      if (whiteTime <= 0) {
        whiteTime = 0;
        stopTimer();
        gameState.isGameOver = true;
        gameState.result = 'black';
        showGameOverModal('black');
      }
    } else {
      blackTime--;
      if (blackTime <= 0) {
        blackTime = 0;
        stopTimer();
        gameState.isGameOver = true;
        gameState.result = 'white';
        showGameOverModal('white');
      }
    }

    updateTimerDisplay();
  }, 1000);
}

function stopTimer() {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
}

function updateTimerDisplay() {
  document.getElementById('white-timer').textContent = formatTime(whiteTime);
  document.getElementById('black-timer').textContent = formatTime(blackTime);
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ========== GAME OVER MODAL ==========
function showGameOverModal(result) {
  const icon = document.getElementById('gameover-icon');
  const title = document.getElementById('gameover-title');
  const msg = document.getElementById('gameover-msg');

  if (result === 'white') {
    icon.textContent = '🏆';
    title.textContent = 'White Wins!';
    msg.textContent = gameMode === 'bot' ? 'Congratulations! You defeated the bot.' : 'White wins by checkmate!';
  } else if (result === 'black') {
    icon.textContent = gameMode === 'bot' ? '😔' : '🏆';
    title.textContent = 'Black Wins!';
    msg.textContent = gameMode === 'bot' ? 'The bot wins this time. Try again!' : 'Black wins by checkmate!';
  } else {
    icon.textContent = '🤝';
    title.textContent = 'Draw!';
    msg.textContent = 'The game ended in a draw.';
  }

  openModal('gameover-modal');
}

// ========== GAME CONTROLS ==========
function undoMove() {
  if (!gameState || gameState.history.length === 0) { showToast('No moves to undo.'); return; }
  if (isBotThinking) return;

  // In bot mode, undo two moves (player + bot)
  if (gameMode === 'bot' && gameState.history.length >= 2) {
    ChessEngine.undoMove(gameState);
    ChessEngine.undoMove(gameState);
  } else {
    ChessEngine.undoMove(gameState);
  }

  selectedSquare = null;
  legalMovesForSelected = [];
  lastMove = null;

  renderBoard();
  updateTurnIndicator();
  updateCaptured();
  rebuildMoveHistory();
  showToast('Move undone.');
}

function rebuildMoveHistory() {
  clearMoveHistory();
  const list = gameState.moveList;
  for (let i = 0; i < list.length; i++) {
    // Rebuild — temporarily push to call addMoveToHistory correctly
    // We need to simulate the count
  }
  // Simpler: just rebuild from moveList
  const movesListEl = document.getElementById('moves-list');
  movesListEl.innerHTML = '';
  for (let i = 0; i < list.length; i += 2) {
    const entry = document.createElement('span');
    entry.className = 'move-entry';
    const num = document.createElement('span');
    num.className = 'move-number';
    num.textContent = (Math.floor(i / 2) + 1) + '.';
    const white = document.createElement('span');
    white.className = 'move-notation';
    white.textContent = list[i];
    entry.appendChild(num);
    entry.appendChild(white);
    if (list[i + 1]) {
      const black = document.createElement('span');
      black.className = 'move-notation';
      black.textContent = list[i + 1];
      entry.appendChild(black);
    }
    movesListEl.appendChild(entry);
  }
}

function resetGame() {
  if (!gameState) return;
  stopTimer();

  gameState = ChessEngine.createGameState();
  selectedSquare = null;
  legalMovesForSelected = [];
  lastMove = null;
  whiteTime = 600;
  blackTime = 600;
  isBotThinking = false;
  pendingPromotion = null;

  renderBoard();
  updateTurnIndicator();
  updateCaptured();
  clearMoveHistory();
  updateTimerDisplay();
  startTimer();
  showToast('New game started!');
}

function resignGame() {
  if (!gameState || gameState.isGameOver) return;
  stopTimer();
  gameState.isGameOver = true;
  const winner = gameState.turn === 'w' ? 'black' : 'white';
  gameState.result = winner;
  showGameOverModal(winner);
}

function backToSetup() {
  stopTimer();
  closeModal('gameover-modal');
  document.getElementById('game-container').classList.add('hidden');
  document.getElementById('game-setup').classList.remove('hidden');

  // Reset setup UI
  document.getElementById('setup-vs-player').classList.remove('active');
  document.getElementById('setup-vs-bot').classList.remove('active');
  document.getElementById('difficulty-section').classList.add('hidden');
  document.getElementById('setup-actions').classList.add('hidden');
  gameMode = null;
  botDifficulty = null;
}

// ========== CHALLENGE PAGE ==========
function selectTime(btn) {
  document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function createChallenge(e) {
  e.preventDefault();
  const opponent = document.getElementById('challenge-opponent').value;
  showToast(`Challenge sent to ${opponent}!`);
  document.getElementById('challenge-opponent').value = '';
}

function acceptChallenge(name) {
  showToast(`Accepted challenge from ${name}! Starting game...`);
  setTimeout(() => {
    gameMode = 'player';
    showPage('play');
    startGame();
  }, 1000);
}

// ========== AI TRAINER CHAT ==========
const chessResponses = {
  'opening': 'Great question! For beginners, I recommend the Italian Game (1.e4 e5 2.Nf3 Nc6 3.Bc4). It\'s straightforward and teaches good principles: control the center, develop pieces, and castle early.',
  'sicilian': 'The Sicilian Defense (1.e4 c5) is the most popular response to 1.e4. It creates asymmetric positions where Black fights for the center from the flank. The Open Sicilian leads to very tactical play.',
  'endgame': 'Key endgame principles: 1) Activate your king — it\'s a fighting piece in the endgame. 2) Passed pawns must be pushed. 3) Rooks belong behind passed pawns. 4) In king and pawn endings, opposition is crucial.',
  'tactics': 'The most common tactical patterns are: Forks (one piece attacks two), Pins (piece can\'t move because it exposes a more valuable piece), Skewers (like a reverse pin), and Discovered attacks. Practice these daily!',
  'checkmate': 'Common checkmate patterns: Back Rank Mate (rook/queen on the 8th rank), Scholar\'s Mate (Qh5-Bc4-Qxf7#), Smothered Mate (knight checkmate with pieces blocking escape), and Anastasia\'s Mate.',
  'improve': 'To improve: 1) Solve tactical puzzles daily. 2) Study basic endgames. 3) Learn 2-3 openings well. 4) Analyze your games to find mistakes. 5) Play longer time controls to think more deeply.',
  'castle': 'Castling is crucial for king safety. Castle early (usually within the first 10 moves). Kingside castling (O-O) is more common as it\'s faster. Avoid moving pawns in front of your castled king.',
  'pin': 'A pin is when a piece can\'t move because it would expose a more valuable piece behind it. Absolute pins (against the king) mean the piece literally cannot move. Use pins to win material!',
  'fork': 'A fork is when one piece attacks two or more enemy pieces simultaneously. Knights are the best forking pieces because they can\'t be blocked. Always look for knight forks, especially involving the king.',
  'gambit': 'A gambit is when you sacrifice material (usually a pawn) for compensation like development, initiative, or attacking chances. Famous gambits: King\'s Gambit, Queen\'s Gambit, Evans Gambit.',
  'default': 'That\'s an interesting chess question! Here\'s a general tip: focus on controlling the center, develop all your pieces before attacking, castle early for king safety, and always look for tactical opportunities. Would you like to know about openings, tactics, or endgames specifically?'
};

function sendChat() {
  const input = document.getElementById('chat-input');
  const msg = input.value.trim();
  if (!msg) return;
  input.value = '';

  const chatBox = document.getElementById('chat-box');

  // User message
  const userDiv = document.createElement('div');
  userDiv.className = 'chat-msg user-msg';
  userDiv.innerHTML = `<span class="chat-avatar">👤</span><div class="chat-bubble">${escapeHtml(msg)}</div>`;
  chatBox.appendChild(userDiv);

  // Bot response
  setTimeout(() => {
    const response = getChessResponse(msg);
    const botDiv = document.createElement('div');
    botDiv.className = 'chat-msg bot-msg';
    botDiv.innerHTML = `<span class="chat-avatar">🤖</span><div class="chat-bubble">${response}</div>`;
    chatBox.appendChild(botDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
  }, 600);

  chatBox.scrollTop = chatBox.scrollHeight;
}

function getChessResponse(msg) {
  const lower = msg.toLowerCase();
  for (const [key, response] of Object.entries(chessResponses)) {
    if (key !== 'default' && lower.includes(key)) return response;
  }
  // Check for common keywords
  if (lower.includes('open')) return chessResponses['opening'];
  if (lower.includes('end')) return chessResponses['endgame'];
  if (lower.includes('tactic') || lower.includes('puzzle')) return chessResponses['tactics'];
  if (lower.includes('mate') || lower.includes('check')) return chessResponses['checkmate'];
  if (lower.includes('better') || lower.includes('improv') || lower.includes('learn') || lower.includes('tip')) return chessResponses['improve'];
  if (lower.includes('sacrifice') || lower.includes('gambit')) return chessResponses['gambit'];
  return chessResponses['default'];
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ========== TRAINER TIP ==========
function showTrainerTip(text) {
  const tip = document.getElementById('trainer-tip');
  document.getElementById('trainer-tip-text').textContent = text;
  tip.classList.remove('hidden');
}

function hideTrainerTip() {
  document.getElementById('trainer-tip').classList.add('hidden');
}
