/* ============================================
   CHESS ENGINE — Full game logic
   Handles board state, move generation,
   validation, check/checkmate/stalemate,
   castling, en passant, promotion, and undo.
   ============================================ */

const ChessEngine = (() => {
  // Piece constants
  const EMPTY = 0;
  const WP = 1, WN = 2, WB = 3, WR = 4, WQ = 5, WK = 6;
  const BP = 7, BN = 8, BB = 9, BR = 10, BQ = 11, BK = 12;

  const PIECE_NAMES = {
    [WP]:'P',[WN]:'N',[WB]:'B',[WR]:'R',[WQ]:'Q',[WK]:'K',
    [BP]:'p',[BN]:'n',[BB]:'b',[BR]:'r',[BQ]:'q',[BK]:'k'
  };

  const PIECE_UNICODE = {
    [WK]:'♔',[WQ]:'♕',[WR]:'♖',[WB]:'♗',[WN]:'♘',[WP]:'♙',
    [BK]:'♚',[BQ]:'♛',[BR]:'♜',[BB]:'♝',[BN]:'♞',[BP]:'♟'
  };

  const PIECE_VALUES = {
    [WP]:100,[WN]:320,[WB]:330,[WR]:500,[WQ]:900,[WK]:20000,
    [BP]:100,[BN]:320,[BB]:330,[BR]:500,[BQ]:900,[BK]:20000
  };

  function isWhite(p) { return p >= 1 && p <= 6; }
  function isBlack(p) { return p >= 7 && p <= 12; }
  function colorOf(p) { return isWhite(p) ? 'w' : isBlack(p) ? 'b' : null; }
  function isAlly(p, turn) { return turn === 'w' ? isWhite(p) : isBlack(p); }
  function isEnemy(p, turn) { return turn === 'w' ? isBlack(p) : isWhite(p); }
  function inBounds(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }

  // Initial board layout
  function createInitialBoard() {
    return [
      [BR, BN, BB, BQ, BK, BB, BN, BR],
      [BP, BP, BP, BP, BP, BP, BP, BP],
      [0,  0,  0,  0,  0,  0,  0,  0],
      [0,  0,  0,  0,  0,  0,  0,  0],
      [0,  0,  0,  0,  0,  0,  0,  0],
      [0,  0,  0,  0,  0,  0,  0,  0],
      [WP, WP, WP, WP, WP, WP, WP, WP],
      [WR, WN, WB, WQ, WK, WB, WN, WR]
    ];
  }

  function createGameState() {
    return {
      board: createInitialBoard(),
      turn: 'w',
      castling: { wK: true, wQ: true, bK: true, bQ: true },
      enPassant: null, // {row, col} of the square that can be captured en passant
      halfMoveClock: 0,
      fullMoveNumber: 1,
      history: [],
      capturedWhite: [], // pieces captured from white (shown near black)
      capturedBlack: [], // pieces captured from black (shown near white)
      moveList: [],      // algebraic notation list
      isGameOver: false,
      result: null
    };
  }

  // Deep clone the board
  function cloneBoard(b) { return b.map(r => [...r]); }

  // Clone entire state (for undo)
  function cloneState(s) {
    return {
      board: cloneBoard(s.board),
      turn: s.turn,
      castling: { ...s.castling },
      enPassant: s.enPassant ? { ...s.enPassant } : null,
      halfMoveClock: s.halfMoveClock,
      fullMoveNumber: s.fullMoveNumber,
      capturedWhite: [...s.capturedWhite],
      capturedBlack: [...s.capturedBlack],
      moveList: [...s.moveList]
    };
  }

  // ========== MOVE GENERATION ==========

  function getPseudoLegalMoves(state, r, c) {
    const board = state.board;
    const piece = board[r][c];
    if (!piece) return [];
    const turn = colorOf(piece);
    const moves = [];

    function addMove(tr, tc, flags = {}) {
      moves.push({ fromR: r, fromC: c, toR: tr, toC: tc, ...flags });
    }

    function slideMoves(dirs) {
      for (const [dr, dc] of dirs) {
        let nr = r + dr, nc = c + dc;
        while (inBounds(nr, nc)) {
          if (board[nr][nc] === EMPTY) {
            addMove(nr, nc);
          } else {
            if (isEnemy(board[nr][nc], turn)) addMove(nr, nc, { capture: true });
            break;
          }
          nr += dr; nc += dc;
        }
      }
    }

    function stepMoves(offsets) {
      for (const [dr, dc] of offsets) {
        const nr = r + dr, nc = c + dc;
        if (inBounds(nr, nc)) {
          if (board[nr][nc] === EMPTY || isEnemy(board[nr][nc], turn)) {
            addMove(nr, nc, { capture: board[nr][nc] !== EMPTY });
          }
        }
      }
    }

    const pType = piece === WP || piece === BP ? 'p' :
                  piece === WN || piece === BN ? 'n' :
                  piece === WB || piece === BB ? 'b' :
                  piece === WR || piece === BR ? 'r' :
                  piece === WQ || piece === BQ ? 'q' : 'k';

    if (pType === 'p') {
      const dir = turn === 'w' ? -1 : 1;
      const startRow = turn === 'w' ? 6 : 1;
      const promoRow = turn === 'w' ? 0 : 7;

      // Forward one
      if (inBounds(r + dir, c) && board[r + dir][c] === EMPTY) {
        if (r + dir === promoRow) {
          addMove(r + dir, c, { promotion: true });
        } else {
          addMove(r + dir, c);
        }
        // Forward two from start
        if (r === startRow && board[r + 2 * dir][c] === EMPTY) {
          addMove(r + 2 * dir, c, { doublePush: true });
        }
      }

      // Captures
      for (const dc of [-1, 1]) {
        const nr = r + dir, nc = c + dc;
        if (inBounds(nr, nc)) {
          if (isEnemy(board[nr][nc], turn)) {
            if (nr === promoRow) {
              addMove(nr, nc, { capture: true, promotion: true });
            } else {
              addMove(nr, nc, { capture: true });
            }
          }
          // En passant
          if (state.enPassant && state.enPassant.row === nr && state.enPassant.col === nc) {
            addMove(nr, nc, { capture: true, enPassant: true });
          }
        }
      }
    } else if (pType === 'n') {
      stepMoves([[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]);
    } else if (pType === 'b') {
      slideMoves([[-1,-1],[-1,1],[1,-1],[1,1]]);
    } else if (pType === 'r') {
      slideMoves([[-1,0],[1,0],[0,-1],[0,1]]);
    } else if (pType === 'q') {
      slideMoves([[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]]);
    } else if (pType === 'k') {
      stepMoves([[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]);

      // Castling
      const row = turn === 'w' ? 7 : 0;
      if (r === row && c === 4) {
        // Kingside
        const ksKey = turn === 'w' ? 'wK' : 'bK';
        if (state.castling[ksKey] && board[row][5] === EMPTY && board[row][6] === EMPTY) {
          if (!isSquareAttacked(board, row, 4, turn) &&
              !isSquareAttacked(board, row, 5, turn) &&
              !isSquareAttacked(board, row, 6, turn)) {
            addMove(row, 6, { castleKing: true });
          }
        }
        // Queenside
        const qsKey = turn === 'w' ? 'wQ' : 'bQ';
        if (state.castling[qsKey] && board[row][3] === EMPTY && board[row][2] === EMPTY && board[row][1] === EMPTY) {
          if (!isSquareAttacked(board, row, 4, turn) &&
              !isSquareAttacked(board, row, 3, turn) &&
              !isSquareAttacked(board, row, 2, turn)) {
            addMove(row, 2, { castleQueen: true });
          }
        }
      }
    }

    return moves;
  }

  // Check if a square is attacked by the opponent of 'turn'
  function isSquareAttacked(board, r, c, turn) {
    const enemy = turn === 'w' ? 'b' : 'w';

    // Pawn attacks
    const pDir = turn === 'w' ? -1 : 1;
    for (const dc of [-1, 1]) {
      const nr = r + pDir, nc = c + dc;
      if (inBounds(nr, nc)) {
        const p = board[nr][nc];
        if ((enemy === 'b' && p === BP) || (enemy === 'w' && p === WP)) return true;
      }
    }

    // Knight attacks
    for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
      const nr = r + dr, nc = c + dc;
      if (inBounds(nr, nc)) {
        const p = board[nr][nc];
        if ((enemy === 'b' && p === BN) || (enemy === 'w' && p === WN)) return true;
      }
    }

    // Bishop/Queen diagonals
    for (const [dr, dc] of [[-1,-1],[-1,1],[1,-1],[1,1]]) {
      let nr = r + dr, nc = c + dc;
      while (inBounds(nr, nc)) {
        const p = board[nr][nc];
        if (p !== EMPTY) {
          if ((enemy === 'b' && (p === BB || p === BQ)) || (enemy === 'w' && (p === WB || p === WQ))) return true;
          break;
        }
        nr += dr; nc += dc;
      }
    }

    // Rook/Queen straights
    for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
      let nr = r + dr, nc = c + dc;
      while (inBounds(nr, nc)) {
        const p = board[nr][nc];
        if (p !== EMPTY) {
          if ((enemy === 'b' && (p === BR || p === BQ)) || (enemy === 'w' && (p === WR || p === WQ))) return true;
          break;
        }
        nr += dr; nc += dc;
      }
    }

    // King attacks
    for (const [dr, dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) {
      const nr = r + dr, nc = c + dc;
      if (inBounds(nr, nc)) {
        const p = board[nr][nc];
        if ((enemy === 'b' && p === BK) || (enemy === 'w' && p === WK)) return true;
      }
    }

    return false;
  }

  function findKing(board, turn) {
    const king = turn === 'w' ? WK : BK;
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++)
        if (board[r][c] === king) return { r, c };
    return null;
  }

  function isInCheck(board, turn) {
    const k = findKing(board, turn);
    return k ? isSquareAttacked(board, k.r, k.c, turn) : false;
  }

  // Filter pseudo-legal to legal (doesn't leave own king in check)
  function getLegalMoves(state, r, c) {
    const pseudoMoves = getPseudoLegalMoves(state, r, c);
    const legal = [];
    for (const move of pseudoMoves) {
      const testBoard = cloneBoard(state.board);
      applyMoveToBoard(testBoard, move, state);
      if (!isInCheck(testBoard, state.turn)) {
        legal.push(move);
      }
    }
    return legal;
  }

  // Apply a move to a board copy (for testing)
  function applyMoveToBoard(board, move, state) {
    const piece = board[move.fromR][move.fromC];
    board[move.toR][move.toC] = piece;
    board[move.fromR][move.fromC] = EMPTY;

    // En passant capture
    if (move.enPassant) {
      const dir = state.turn === 'w' ? 1 : -1;
      board[move.toR + dir][move.toC] = EMPTY;
    }

    // Castling rook move
    if (move.castleKing) {
      const row = move.fromR;
      board[row][5] = board[row][7];
      board[row][7] = EMPTY;
    }
    if (move.castleQueen) {
      const row = move.fromR;
      board[row][3] = board[row][0];
      board[row][0] = EMPTY;
    }

    // Promotion (default queen for testing)
    if (move.promotion && !move.promotionPiece) {
      board[move.toR][move.toC] = state.turn === 'w' ? WQ : BQ;
    } else if (move.promotionPiece) {
      board[move.toR][move.toC] = move.promotionPiece;
    }
  }

  // Get ALL legal moves for a side
  function getAllLegalMoves(state) {
    const moves = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (isAlly(state.board[r][c], state.turn)) {
          moves.push(...getLegalMoves(state, r, c));
        }
      }
    }
    return moves;
  }

  // ========== MAKE MOVE ==========

  function makeMove(state, move) {
    // Save state for undo
    state.history.push(cloneState(state));

    const board = state.board;
    const piece = board[move.fromR][move.fromC];
    const captured = board[move.toR][move.toC];

    // Build algebraic notation
    const notation = buildNotation(state, move, piece, captured);

    // Handle captures
    if (captured) {
      if (isWhite(captured)) state.capturedWhite.push(captured);
      else state.capturedBlack.push(captured);
    }

    // En passant capture
    if (move.enPassant) {
      const dir = state.turn === 'w' ? 1 : -1;
      const epPiece = board[move.toR + dir][move.toC];
      if (isWhite(epPiece)) state.capturedWhite.push(epPiece);
      else state.capturedBlack.push(epPiece);
      board[move.toR + dir][move.toC] = EMPTY;
    }

    // Move piece
    board[move.toR][move.toC] = piece;
    board[move.fromR][move.fromC] = EMPTY;

    // Castling rook
    if (move.castleKing) {
      const row = move.fromR;
      board[row][5] = board[row][7];
      board[row][7] = EMPTY;
    }
    if (move.castleQueen) {
      const row = move.fromR;
      board[row][3] = board[row][0];
      board[row][0] = EMPTY;
    }

    // Promotion
    if (move.promotionPiece) {
      board[move.toR][move.toC] = move.promotionPiece;
    }

    // Update castling rights
    if (piece === WK) { state.castling.wK = false; state.castling.wQ = false; }
    if (piece === BK) { state.castling.bK = false; state.castling.bQ = false; }
    if (piece === WR && move.fromR === 7 && move.fromC === 7) state.castling.wK = false;
    if (piece === WR && move.fromR === 7 && move.fromC === 0) state.castling.wQ = false;
    if (piece === BR && move.fromR === 0 && move.fromC === 7) state.castling.bK = false;
    if (piece === BR && move.fromR === 0 && move.fromC === 0) state.castling.bQ = false;
    // If rook captured
    if (move.toR === 0 && move.toC === 7) state.castling.bK = false;
    if (move.toR === 0 && move.toC === 0) state.castling.bQ = false;
    if (move.toR === 7 && move.toC === 7) state.castling.wK = false;
    if (move.toR === 7 && move.toC === 0) state.castling.wQ = false;

    // En passant target
    if (move.doublePush) {
      const epRow = state.turn === 'w' ? move.fromR - 1 : move.fromR + 1;
      state.enPassant = { row: epRow, col: move.fromC };
    } else {
      state.enPassant = null;
    }

    // Half-move clock
    if (piece === WP || piece === BP || captured || move.enPassant) {
      state.halfMoveClock = 0;
    } else {
      state.halfMoveClock++;
    }

    // Switch turn
    if (state.turn === 'b') state.fullMoveNumber++;
    state.turn = state.turn === 'w' ? 'b' : 'w';

    // Check for check/checkmate/stalemate
    const oppMoves = getAllLegalMoves(state);
    const inCheck = isInCheck(state.board, state.turn);

    let finalNotation = notation;
    if (oppMoves.length === 0) {
      if (inCheck) {
        state.isGameOver = true;
        state.result = state.turn === 'w' ? 'black' : 'white';
        finalNotation += '#';
      } else {
        state.isGameOver = true;
        state.result = 'draw';
      }
    } else if (inCheck) {
      finalNotation += '+';
    }

    // Draw by insufficient material
    if (!state.isGameOver && isInsufficientMaterial(state.board)) {
      state.isGameOver = true;
      state.result = 'draw';
    }

    // 50-move rule
    if (!state.isGameOver && state.halfMoveClock >= 100) {
      state.isGameOver = true;
      state.result = 'draw';
    }

    state.moveList.push(finalNotation);

    return { notation: finalNotation, captured, inCheck, isGameOver: state.isGameOver, result: state.result };
  }

  function buildNotation(state, move, piece, captured) {
    if (move.castleKing) return 'O-O';
    if (move.castleQueen) return 'O-O-O';

    const files = 'abcdefgh';
    const ranks = '87654321';
    let n = '';

    const pType = piece === WP || piece === BP ? 'P' :
                  piece === WN || piece === BN ? 'N' :
                  piece === WB || piece === BB ? 'B' :
                  piece === WR || piece === BR ? 'R' :
                  piece === WQ || piece === BQ ? 'Q' : 'K';

    if (pType !== 'P') {
      n += pType;
      // Disambiguation
      const allMoves = getAllLegalMoves(state);
      const sameTypeMoves = allMoves.filter(m =>
        state.board[m.fromR][m.fromC] === piece &&
        m.toR === move.toR && m.toC === move.toC &&
        (m.fromR !== move.fromR || m.fromC !== move.fromC)
      );
      if (sameTypeMoves.length > 0) {
        const sameFile = sameTypeMoves.some(m => m.fromC === move.fromC);
        const sameRank = sameTypeMoves.some(m => m.fromR === move.fromR);
        if (!sameFile) n += files[move.fromC];
        else if (!sameRank) n += ranks[move.fromR];
        else n += files[move.fromC] + ranks[move.fromR];
      }
    } else if (captured || move.enPassant) {
      n += files[move.fromC];
    }

    if (captured || move.enPassant) n += 'x';
    n += files[move.toC] + ranks[move.toR];

    if (move.promotionPiece) {
      const promoType = piece <= 6 ?
        { [WQ]:'Q',[WR]:'R',[WB]:'B',[WN]:'N' }[move.promotionPiece] :
        { [BQ]:'Q',[BR]:'R',[BB]:'B',[BN]:'N' }[move.promotionPiece];
      n += '=' + (promoType || 'Q');
    }

    return n;
  }

  function isInsufficientMaterial(board) {
    const pieces = [];
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++)
        if (board[r][c]) pieces.push({ piece: board[r][c], r, c });

    if (pieces.length === 2) return true; // K vs K
    if (pieces.length === 3) {
      const nonKing = pieces.find(p => p.piece !== WK && p.piece !== BK);
      if (nonKing && (nonKing.piece === WN || nonKing.piece === BN || nonKing.piece === WB || nonKing.piece === BB))
        return true;
    }
    if (pieces.length === 4) {
      const bishops = pieces.filter(p => p.piece === WB || p.piece === BB);
      if (bishops.length === 2) {
        const sameColor = (bishops[0].r + bishops[0].c) % 2 === (bishops[1].r + bishops[1].c) % 2;
        if (sameColor) return true;
      }
    }
    return false;
  }

  function undoMove(state) {
    if (state.history.length === 0) return false;
    const prev = state.history.pop();
    state.board = prev.board;
    state.turn = prev.turn;
    state.castling = prev.castling;
    state.enPassant = prev.enPassant;
    state.halfMoveClock = prev.halfMoveClock;
    state.fullMoveNumber = prev.fullMoveNumber;
    state.capturedWhite = prev.capturedWhite;
    state.capturedBlack = prev.capturedBlack;
    state.moveList = prev.moveList;
    state.isGameOver = false;
    state.result = null;
    return true;
  }

  // Public API
  return {
    EMPTY, WP, WN, WB, WR, WQ, WK, BP, BN, BB, BR, BQ, BK,
    PIECE_UNICODE, PIECE_VALUES, PIECE_NAMES,
    isWhite, isBlack, colorOf, isAlly, isEnemy,
    createGameState,
    cloneBoard,
    getLegalMoves,
    getAllLegalMoves,
    makeMove,
    undoMove,
    isInCheck,
    findKing,
    isSquareAttacked
  };
})();
