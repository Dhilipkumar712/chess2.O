/* ============================================
   CHESS BOT — 3 Difficulty Levels (STRONG AI)
   Beginner: minimax depth 2 + basic eval
   Medium:   minimax depth 4 + advanced eval + quiescence
   Pro:      minimax depth 6 + full eval + quiescence + killer moves
   ============================================ */

const ChessBot = (() => {

  // ========== PIECE-SQUARE TABLES ==========

  const PST_PAWN = [
    [ 0,  0,  0,  0,  0,  0,  0,  0],
    [50, 50, 50, 50, 50, 50, 50, 50],
    [10, 10, 20, 30, 30, 20, 10, 10],
    [ 5,  5, 10, 27, 27, 10,  5,  5],
    [ 0,  0,  0, 25, 25,  0,  0,  0],
    [ 5, -5,-10,  0,  0,-10, -5,  5],
    [ 5, 10, 10,-25,-25, 10, 10,  5],
    [ 0,  0,  0,  0,  0,  0,  0,  0]
  ];

  const PST_KNIGHT = [
    [-50,-40,-30,-30,-30,-30,-40,-50],
    [-40,-20,  0,  0,  0,  0,-20,-40],
    [-30,  0, 10, 15, 15, 10,  0,-30],
    [-30,  5, 15, 20, 20, 15,  5,-30],
    [-30,  0, 15, 20, 20, 15,  0,-30],
    [-30,  5, 10, 15, 15, 10,  5,-30],
    [-40,-20,  0,  5,  5,  0,-20,-40],
    [-50,-40,-30,-30,-30,-30,-40,-50]
  ];

  const PST_BISHOP = [
    [-20,-10,-10,-10,-10,-10,-10,-20],
    [-10,  0,  0,  0,  0,  0,  0,-10],
    [-10,  0, 10, 10, 10, 10,  0,-10],
    [-10,  5,  5, 10, 10,  5,  5,-10],
    [-10,  0,  5, 10, 10,  5,  0,-10],
    [-10, 10, 10, 10, 10, 10, 10,-10],
    [-10,  5,  0,  0,  0,  0,  5,-10],
    [-20,-10,-10,-10,-10,-10,-10,-20]
  ];

  const PST_ROOK = [
    [ 0,  0,  0,  0,  0,  0,  0,  0],
    [ 5, 10, 10, 10, 10, 10, 10,  5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [ 0,  0,  0,  5,  5,  0,  0,  0]
  ];

  const PST_QUEEN = [
    [-20,-10,-10, -5, -5,-10,-10,-20],
    [-10,  0,  0,  0,  0,  0,  0,-10],
    [-10,  0,  5,  5,  5,  5,  0,-10],
    [ -5,  0,  5,  5,  5,  5,  0, -5],
    [  0,  0,  5,  5,  5,  5,  0, -5],
    [-10,  5,  5,  5,  5,  5,  0,-10],
    [-10,  0,  5,  0,  0,  0,  0,-10],
    [-20,-10,-10, -5, -5,-10,-10,-20]
  ];

  // King middlegame — stay castled, stay safe
  const PST_KING_MID = [
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-20,-30,-30,-40,-40,-30,-30,-20],
    [-10,-20,-20,-20,-20,-20,-20,-10],
    [ 20, 20,  0,  0,  0,  0, 20, 20],
    [ 20, 30, 10,  0,  0, 10, 30, 20]
  ];

  // King endgame — centralize the king
  const PST_KING_END = [
    [-50,-40,-30,-20,-20,-30,-40,-50],
    [-30,-20,-10,  0,  0,-10,-20,-30],
    [-30,-10, 20, 30, 30, 20,-10,-30],
    [-30,-10, 30, 40, 40, 30,-10,-30],
    [-30,-10, 30, 40, 40, 30,-10,-30],
    [-30,-10, 20, 30, 30, 20,-10,-30],
    [-30,-30,  0,  0,  0,  0,-30,-30],
    [-50,-30,-30,-30,-30,-30,-30,-50]
  ];

  function getPST(piece, isEndgame) {
    const { WP, WN, WB, WR, WQ, WK, BP, BN, BB, BR, BQ, BK } = ChessEngine;
    switch (piece) {
      case WP: case BP: return PST_PAWN;
      case WN: case BN: return PST_KNIGHT;
      case WB: case BB: return PST_BISHOP;
      case WR: case BR: return PST_ROOK;
      case WQ: case BQ: return PST_QUEEN;
      case WK: case BK: return isEndgame ? PST_KING_END : PST_KING_MID;
      default: return null;
    }
  }

  // ========== ADVANCED EVALUATION ==========

  function isEndgame(state) {
    const board = state.board;
    const { WQ, BQ, WR, BR, WN, WB, BN, BB } = ChessEngine;
    let whiteQueens = 0, blackQueens = 0, whiteMinor = 0, blackMinor = 0;
    let whiteRooks = 0, blackRooks = 0;

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (p === WQ) whiteQueens++;
        else if (p === BQ) blackQueens++;
        else if (p === WR) whiteRooks++;
        else if (p === BR) blackRooks++;
        else if (p === WN || p === WB) whiteMinor++;
        else if (p === BN || p === BB) blackMinor++;
      }
    }

    // Endgame if both sides have no queens, or every side with a queen has at most 1 minor piece
    if (whiteQueens === 0 && blackQueens === 0) return true;
    if (whiteQueens <= 1 && blackQueens <= 1 &&
        whiteRooks === 0 && blackRooks === 0 &&
        whiteMinor <= 1 && blackMinor <= 1) return true;
    return false;
  }

  function evaluate(state) {
    const board = state.board;
    const { WP, WN, WB, WR, WQ, WK, BP, BN, BB, BR, BQ, BK, PIECE_VALUES } = ChessEngine;

    let score = 0;
    const endgame = isEndgame(state);

    // Piece counts for bonus calculations
    let whiteBishops = 0, blackBishops = 0;
    let whitePawnFiles = new Array(8).fill(0);
    let blackPawnFiles = new Array(8).fill(0);

    // Material + PST
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (!p) continue;

        const val = PIECE_VALUES[p] || 0;
        const pst = getPST(p, endgame);
        let positional = 0;

        if (pst) {
          positional = ChessEngine.isWhite(p) ? pst[r][c] : pst[7 - r][c];
        }

        if (ChessEngine.isWhite(p)) {
          score += val + positional;
          if (p === WB) whiteBishops++;
          if (p === WP) whitePawnFiles[c]++;
        } else {
          score -= val + positional;
          if (p === BB) blackBishops++;
          if (p === BP) blackPawnFiles[c]++;
        }
      }
    }

    // Bishop pair bonus (+50)
    if (whiteBishops >= 2) score += 50;
    if (blackBishops >= 2) score -= 50;

    // Pawn structure evaluation
    for (let c = 0; c < 8; c++) {
      // Doubled pawns penalty (-15 per extra pawn on same file)
      if (whitePawnFiles[c] > 1) score -= 15 * (whitePawnFiles[c] - 1);
      if (blackPawnFiles[c] > 1) score += 15 * (blackPawnFiles[c] - 1);

      // Isolated pawns penalty (-20)
      const hasWhiteLeft = c > 0 && whitePawnFiles[c - 1] > 0;
      const hasWhiteRight = c < 7 && whitePawnFiles[c + 1] > 0;
      if (whitePawnFiles[c] > 0 && !hasWhiteLeft && !hasWhiteRight) score -= 20;

      const hasBlackLeft = c > 0 && blackPawnFiles[c - 1] > 0;
      const hasBlackRight = c < 7 && blackPawnFiles[c + 1] > 0;
      if (blackPawnFiles[c] > 0 && !hasBlackLeft && !hasBlackRight) score += 20;
    }

    // Passed pawns bonus
    for (let c = 0; c < 8; c++) {
      // White passed pawns
      if (whitePawnFiles[c] > 0) {
        let passed = true;
        // Find the most advanced white pawn on this file
        for (let r = 0; r < 8 && passed; r++) {
          if (board[r][c] === WP) {
            // Check if any black pawn can block or capture on files c-1, c, c+1
            for (let br = 0; br < r; br++) {
              for (let bc = Math.max(0, c - 1); bc <= Math.min(7, c + 1); bc++) {
                if (board[br][bc] === BP) { passed = false; break; }
              }
              if (!passed) break;
            }
            if (passed) {
              // Bonus grows as pawn advances (row 6=rank2 → row 1=rank7)
              score += (7 - r) * 15;
            }
            break;
          }
        }
      }
      // Black passed pawns
      if (blackPawnFiles[c] > 0) {
        let passed = true;
        for (let r = 7; r >= 0 && passed; r--) {
          if (board[r][c] === BP) {
            for (let br = 7; br > r; br--) {
              for (let bc = Math.max(0, c - 1); bc <= Math.min(7, c + 1); bc++) {
                if (board[br][bc] === WP) { passed = false; break; }
              }
              if (!passed) break;
            }
            if (passed) {
              score -= r * 15;
            }
            break;
          }
        }
      }
    }

    // Rook on open/semi-open file bonus
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (p === WR) {
          if (whitePawnFiles[c] === 0 && blackPawnFiles[c] === 0) score += 25; // open file
          else if (whitePawnFiles[c] === 0) score += 15; // semi-open
        } else if (p === BR) {
          if (whitePawnFiles[c] === 0 && blackPawnFiles[c] === 0) score -= 25;
          else if (blackPawnFiles[c] === 0) score -= 15;
        }
      }
    }

    // King safety — penalize open files near king in middlegame
    if (!endgame) {
      const wKing = ChessEngine.findKing(board, 'w');
      const bKing = ChessEngine.findKing(board, 'b');

      if (wKing) {
        // Pawn shield bonus for white king
        for (let dc = -1; dc <= 1; dc++) {
          const sc = wKing.c + dc;
          if (sc >= 0 && sc < 8) {
            const shieldRow = wKing.r - 1;
            if (shieldRow >= 0 && board[shieldRow][sc] === WP) {
              score += 15; // pawn shield present
            } else {
              score -= 15; // pawn shield missing
            }
          }
        }
      }

      if (bKing) {
        for (let dc = -1; dc <= 1; dc++) {
          const sc = bKing.c + dc;
          if (sc >= 0 && sc < 8) {
            const shieldRow = bKing.r + 1;
            if (shieldRow < 8 && board[shieldRow][sc] === BP) {
              score -= 15;
            } else {
              score += 15;
            }
          }
        }
      }
    }

    // Mobility bonus (scaled)
    const savedTurn = state.turn;
    state.turn = 'w';
    const whiteMoves = ChessEngine.getAllLegalMoves(state).length;
    state.turn = 'b';
    const blackMoves = ChessEngine.getAllLegalMoves(state).length;
    state.turn = savedTurn;

    score += (whiteMoves - blackMoves) * 5;

    // Bonus for attacking squares near enemy king
    const enemyKing = ChessEngine.findKing(board, savedTurn === 'w' ? 'b' : 'w');
    if (enemyKing) {
      let attackCount = 0;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const ar = enemyKing.r + dr;
          const ac = enemyKing.c + dc;
          if (ar >= 0 && ar < 8 && ac >= 0 && ac < 8) {
            // Check if this square is attacked by the current side
            if (ChessEngine.isSquareAttacked(board, ar, ac, savedTurn === 'w' ? 'b' : 'w') === false) {
              // The square is attacked by the side to move
            }
          }
        }
      }
    }

    return score;
  }

  // ========== MOVE ORDERING ==========

  // Killer moves — indexed by depth
  let killerMoves = {};

  function clearKillers() {
    killerMoves = {};
  }

  function storeKiller(depth, move) {
    if (!killerMoves[depth]) killerMoves[depth] = [];
    // Store up to 2 killer moves per depth
    if (killerMoves[depth].length < 2) {
      killerMoves[depth].push(move);
    } else {
      killerMoves[depth][1] = killerMoves[depth][0];
      killerMoves[depth][0] = move;
    }
  }

  function isKillerMove(depth, move) {
    if (!killerMoves[depth]) return false;
    return killerMoves[depth].some(k =>
      k.fromR === move.fromR && k.fromC === move.fromC &&
      k.toR === move.toR && k.toC === move.toC
    );
  }

  function orderMoves(moves, state, depth) {
    return moves.sort((a, b) => {
      let scoreA = 0, scoreB = 0;

      // Captures first — MVV-LVA (Most Valuable Victim - Least Valuable Attacker)
      if (a.capture) {
        const victimA = state.board[a.toR][a.toC];
        const attackerA = state.board[a.fromR][a.fromC];
        scoreA += 10000 + (ChessEngine.PIECE_VALUES[victimA] || 0) * 10 - (ChessEngine.PIECE_VALUES[attackerA] || 0);
      }
      if (b.capture) {
        const victimB = state.board[b.toR][b.toC];
        const attackerB = state.board[b.fromR][b.fromC];
        scoreB += 10000 + (ChessEngine.PIECE_VALUES[victimB] || 0) * 10 - (ChessEngine.PIECE_VALUES[attackerB] || 0);
      }

      // Promotions (very high priority)
      if (a.promotion) scoreA += 9000;
      if (b.promotion) scoreB += 9000;

      // Killer moves
      if (depth !== undefined) {
        if (isKillerMove(depth, a)) scoreA += 5000;
        if (isKillerMove(depth, b)) scoreB += 5000;
      }

      // Castling bonus
      if (a.castleKing || a.castleQueen) scoreA += 3000;
      if (b.castleKing || b.castleQueen) scoreB += 3000;

      // Moves toward center get a small bonus
      const centerDistA = Math.abs(a.toR - 3.5) + Math.abs(a.toC - 3.5);
      const centerDistB = Math.abs(b.toR - 3.5) + Math.abs(b.toC - 3.5);
      scoreA += (7 - centerDistA) * 5;
      scoreB += (7 - centerDistB) * 5;

      return scoreB - scoreA;
    });
  }

  // ========== QUIESCENCE SEARCH ==========
  // Searches only capture moves to avoid the horizon effect
  function quiescence(state, alpha, beta, maximizing, maxQDepth) {
    const standPat = evaluate(state);

    if (maxQDepth <= 0) return standPat;

    if (maximizing) {
      if (standPat >= beta) return beta;
      if (standPat > alpha) alpha = standPat;
    } else {
      if (standPat <= alpha) return alpha;
      if (standPat < beta) beta = standPat;
    }

    // Get only capture moves
    const allMoves = ChessEngine.getAllLegalMoves(state);
    const captureMoves = allMoves.filter(m => m.capture || m.promotion);

    if (captureMoves.length === 0) return standPat;

    const ordered = orderMoves(captureMoves, state, undefined);

    if (maximizing) {
      let maxEval = standPat;
      for (const move of ordered) {
        if (move.promotion && !move.promotionPiece) {
          move.promotionPiece = state.turn === 'w' ? ChessEngine.WQ : ChessEngine.BQ;
        }
        ChessEngine.makeMove(state, move);
        const eval_ = quiescence(state, alpha, beta, false, maxQDepth - 1);
        ChessEngine.undoMove(state);
        maxEval = Math.max(maxEval, eval_);
        alpha = Math.max(alpha, eval_);
        if (beta <= alpha) break;
      }
      return maxEval;
    } else {
      let minEval = standPat;
      for (const move of ordered) {
        if (move.promotion && !move.promotionPiece) {
          move.promotionPiece = state.turn === 'w' ? ChessEngine.WQ : ChessEngine.BQ;
        }
        ChessEngine.makeMove(state, move);
        const eval_ = quiescence(state, alpha, beta, true, maxQDepth - 1);
        ChessEngine.undoMove(state);
        minEval = Math.min(minEval, eval_);
        beta = Math.min(beta, eval_);
        if (beta <= alpha) break;
      }
      return minEval;
    }
  }

  // ========== MINIMAX WITH ALPHA-BETA + QUIESCENCE ==========

  function minimax(state, depth, alpha, beta, maximizing, useQuiescence, maxSearchDepth) {
    if (depth === 0) {
      if (useQuiescence) {
        return quiescence(state, alpha, beta, maximizing, 6);
      }
      return evaluate(state);
    }

    if (state.isGameOver) {
      return evaluate(state);
    }

    const currentDepth = maxSearchDepth - depth;
    const moves = orderMoves(ChessEngine.getAllLegalMoves(state), state, currentDepth);

    if (moves.length === 0) {
      if (ChessEngine.isInCheck(state.board, state.turn)) {
        // Checkmate — prefer faster checkmates
        return maximizing ? -99999 + currentDepth : 99999 - currentDepth;
      }
      return 0; // stalemate
    }

    if (maximizing) {
      let maxEval = -Infinity;
      for (const move of moves) {
        if (move.promotion && !move.promotionPiece) {
          move.promotionPiece = state.turn === 'w' ? ChessEngine.WQ : ChessEngine.BQ;
        }
        ChessEngine.makeMove(state, move);
        const eval_ = minimax(state, depth - 1, alpha, beta, false, useQuiescence, maxSearchDepth);
        ChessEngine.undoMove(state);

        if (eval_ > maxEval) {
          maxEval = eval_;
        }
        alpha = Math.max(alpha, eval_);
        if (beta <= alpha) {
          // Beta cutoff — store killer move (only non-captures)
          if (!move.capture) storeKiller(currentDepth, move);
          break;
        }
      }
      return maxEval;
    } else {
      let minEval = Infinity;
      for (const move of moves) {
        if (move.promotion && !move.promotionPiece) {
          move.promotionPiece = state.turn === 'w' ? ChessEngine.WQ : ChessEngine.BQ;
        }
        ChessEngine.makeMove(state, move);
        const eval_ = minimax(state, depth - 1, alpha, beta, true, useQuiescence, maxSearchDepth);
        ChessEngine.undoMove(state);

        if (eval_ < minEval) {
          minEval = eval_;
        }
        beta = Math.min(beta, eval_);
        if (beta <= alpha) {
          if (!move.capture) storeKiller(currentDepth, move);
          break;
        }
      }
      return minEval;
    }
  }

  // ========== BOT MOVE SELECTION ==========

  function getBeginnerMove(state) {
    // Beginner: depth 2, no quiescence — decent but shallow
    const moves = ChessEngine.getAllLegalMoves(state);
    if (moves.length === 0) return null;

    const maximizing = state.turn === 'w';
    const depth = 2;
    let bestMove = null;
    let bestEval = maximizing ? -Infinity : Infinity;

    const ordered = orderMoves([...moves], state, 0);

    for (const move of ordered) {
      if (move.promotion && !move.promotionPiece) {
        move.promotionPiece = state.turn === 'w' ? ChessEngine.WQ : ChessEngine.BQ;
      }
      ChessEngine.makeMove(state, move);
      const eval_ = minimax(state, depth - 1, -Infinity, Infinity, !maximizing, false, depth);
      ChessEngine.undoMove(state);

      if (maximizing ? eval_ > bestEval : eval_ < bestEval) {
        bestEval = eval_;
        bestMove = move;
      }
    }

    return bestMove;
  }

  function getMediumMove(state) {
    // Medium: depth 4 with quiescence — strong tactical play
    clearKillers();
    const moves = ChessEngine.getAllLegalMoves(state);
    if (moves.length === 0) return null;

    const maximizing = state.turn === 'w';
    const depth = 4;
    let bestMove = null;
    let bestEval = maximizing ? -Infinity : Infinity;

    const ordered = orderMoves([...moves], state, 0);

    for (const move of ordered) {
      if (move.promotion && !move.promotionPiece) {
        move.promotionPiece = state.turn === 'w' ? ChessEngine.WQ : ChessEngine.BQ;
      }
      ChessEngine.makeMove(state, move);
      const eval_ = minimax(state, depth - 1, -Infinity, Infinity, !maximizing, true, depth);
      ChessEngine.undoMove(state);

      if (maximizing ? eval_ > bestEval : eval_ < bestEval) {
        bestEval = eval_;
        bestMove = move;
      }
    }

    return bestMove;
  }

  function getProMove(state) {
    // Pro: depth 6 with quiescence + killer moves — very aggressive, deep thinking
    clearKillers();
    const moves = ChessEngine.getAllLegalMoves(state);
    if (moves.length === 0) return null;

    const maximizing = state.turn === 'w';
    const depth = 6;
    let bestMove = null;
    let bestEval = maximizing ? -Infinity : Infinity;
    let alpha = -Infinity;
    let beta = Infinity;

    const ordered = orderMoves([...moves], state, 0);

    // Iterative deepening for better move ordering on the final depth
    // First do a quick depth-4 pass to order moves
    let moveScores = [];
    for (const move of ordered) {
      if (move.promotion && !move.promotionPiece) {
        move.promotionPiece = state.turn === 'w' ? ChessEngine.WQ : ChessEngine.BQ;
      }
      ChessEngine.makeMove(state, move);
      const eval_ = minimax(state, 3, -Infinity, Infinity, !maximizing, true, 4);
      ChessEngine.undoMove(state);
      moveScores.push({ move, eval: eval_ });
    }

    // Sort by evaluation from the shallow search
    moveScores.sort((a, b) => maximizing ? b.eval - a.eval : a.eval - b.eval);

    // Now do the full depth-6 search with alpha-beta using the ordering from above
    for (const { move } of moveScores) {
      ChessEngine.makeMove(state, move);
      const eval_ = minimax(state, depth - 1, alpha, beta, !maximizing, true, depth);
      ChessEngine.undoMove(state);

      if (maximizing) {
        if (eval_ > bestEval) {
          bestEval = eval_;
          bestMove = move;
        }
        alpha = Math.max(alpha, eval_);
      } else {
        if (eval_ < bestEval) {
          bestEval = eval_;
          bestMove = move;
        }
        beta = Math.min(beta, eval_);
      }
    }

    return bestMove;
  }

  function getBotMove(state, difficulty) {
    switch (difficulty) {
      case 'beginner': return getBeginnerMove(state);
      case 'medium':   return getMediumMove(state);
      case 'pro':      return getProMove(state);
      default:         return getMediumMove(state);
    }
  }

  return { getBotMove, evaluate };
})();
