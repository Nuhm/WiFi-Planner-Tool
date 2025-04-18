import React, { useEffect, useRef, useState } from "react";
import { v4 as uuidv4 } from 'uuid';
import { detectRooms } from '../components/RoomDetection';
import "../styles/Workspace.css";
import { useToast } from './ToastContext';
import { createGrid } from "./grid/createGrid";
import { drawPreview } from "./grid/drawPreview";

const CanvasGrid = ({ isPanning, isAddingNode, isSelecting, isPlacingAP, isTestingSignal, nodes, setNodes, walls, setWalls, selectedNode, setSelectedNode, lastAddedNode, setLastAddedNode, selectedWall, setSelectedWall, selectedAP, setSelectedAP, openConfigSidebar, accessPoints, setAccessPoints }) => {
  const canvasRef = useRef(null);
  const [zoom, setZoom] = useState(10);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [showRooms, setShowRooms] = useState(true);
  const [showCoverage, setShowCoverage] = useState(true);
  const [showUnits, setShowUnits] = useState(true);
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  const [preview, setPreview] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isValidPreview, setIsValidPreview] = useState(true);
  const roomColorsRef = useRef({});
  const [history, setHistory] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [roomShapes, setRoomShapes] = useState([]);
  const [heatmapTiles, setHeatmapTiles] = useState([]);
  const [isDeleting, setIsDeleting] = useState(false);

  const selectedColor = "orange";

  const { showToast } = useToast();
  const baseGridSize = 10;
  const gridSizes = {
    base: baseGridSize,
    main: baseGridSize * zoom,
    sub: (baseGridSize * zoom) / 5,
    subSub: (baseGridSize * zoom) / 10,
  };
  
  const MAX_HISTORY_LENGTH = 20;
  const saveStateToHistory = () => {
    const state = {
      nodes: JSON.parse(JSON.stringify(nodes)),
      walls: JSON.parse(JSON.stringify(walls)),
    };
    setHistory((prev) => [...prev.slice(-MAX_HISTORY_LENGTH + 1), state]);
    setRedoStack([]); // Clear redo stack on new change
  };

  const dragStart = useRef({ x: 0, y: 0 });

  // Zoom handling with manual event listener for non-passive event
  const handleZoom = (event) => {
    event.preventDefault(); // Prevent the default scroll behavior
    const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
    setZoom(Math.max(1, Math.min(zoom * zoomFactor, 50)));
  };

  useEffect(() => {
    if (!isAddingNode) {
      setLastAddedNode(null);
    }
  }, [isAddingNode]);

  // Manually attach the event listener with passive: false
  useEffect(() => {
    const canvasContainer = document.querySelector('.canvas-container');
    if (canvasContainer) {
      canvasContainer.addEventListener('wheel', handleZoom, { passive: false });

      // Clean up the event listener when the component unmounts
      return () => {
        canvasContainer.removeEventListener('wheel', handleZoom);
      };
    }
  }, [zoom]); // Reattach listener whenever zoom state changes

  const getPolygonArea = (points) => {
    let area = 0;
    const n = points.length;
    for (let i = 0; i < n; i++) {
      const { x: x1, y: y1 } = points[i];
      const { x: x2, y: y2 } = points[(i + 1) % n];
      area += x1 * y2 - x2 * y1;
    }
    return Math.abs(area / 2);
  };

  useEffect(() => {
    const allRooms = detectRooms(walls);
    const filtered = allRooms.filter(room => getPolygonArea(room) >= 10);
    setRoomShapes(filtered);
  }, [walls]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    canvas.width = window.innerWidth * 2;
    canvas.height = window.innerHeight * 2;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // **Set (0,0) to Grid Center**
    const centerX = canvas.width / 2 + offset.x;
    const centerY = canvas.height / 2 + offset.y;

    if (showGrid) {
      createGrid(canvas, ctx, zoom, centerX, centerY, gridSizes);
    }

    let roomColorsRef = {};
    let nextHue = 0;

    if (showRooms) {
      // Fill Rooms First
      roomShapes.forEach(nodes => {
        ctx.beginPath();
        nodes.forEach(({ x, y }, i) => {
          const screenX = centerX + x * zoom;
          const screenY = centerY + y * zoom;
          if (i === 0) ctx.moveTo(screenX, screenY);
          else ctx.lineTo(screenX, screenY);
        });
        ctx.closePath();

        const key = nodes.map(n => `${n.x},${n.y}`).sort().join('|');
        if (!roomColorsRef[key]) {
          const hue = (nextHue * 137.508) % 360; // golden angle for better spread
          roomColorsRef[key] = `hsla(${hue}, 80%, 60%, 0.15)`;
          nextHue++;
        }

        ctx.fillStyle = roomColorsRef[key];
        ctx.fill();
      });
    }
    
    // WiFi Signal Heatmap Rendering
    const maxRange = 50; // in world units
    const gridStep = gridSizes.base / 10;
    if (showCoverage) {
      const signalToColor = (dbm) => {
        if (dbm > -50) return "rgba(0,255,0,0.25)";
        if (dbm > -70) return "rgba(255,255,0,0.25)";
        if (dbm > -85) return "rgba(255,165,0,0.25)";
        return "rgba(255,0,0,0.25)";
      };

      heatmapTiles.forEach(({ x, y, signal }) => {
        const screenX = centerX + x * zoom;
        const screenY = centerY + y * zoom;
        const buffer = gridStep * zoom;
        if (
          screenX < -buffer ||
          screenY < -buffer ||
          screenX > canvas.width + buffer ||
          screenY > canvas.height + buffer
        )
          return;

        ctx.fillStyle = signalToColor(signal);
        ctx.fillRect(
          screenX - (gridStep * zoom) / 2,
          screenY - (gridStep * zoom) / 2,
          gridStep * zoom,
          gridStep * zoom
        );
      });
    }
    
    // **Draw Walls (Lines between nodes)**
    walls.forEach((wall) => {
      const { a: startNode, b: endNode } = wall;
      const dx = endNode.x - startNode.x;
      const dy = endNode.y - startNode.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      if (length === 0) {
        console.log("⚠️ Zero-length wall detected:", startNode, endNode);
      }

      const startX = centerX + startNode.x * zoom;
      const startY = centerY + startNode.y * zoom;
      const endX = centerX + endNode.x * zoom;
      const endY = centerY + endNode.y * zoom;
    
      ctx.lineWidth = 6;

      if (selectedWall && wall.id === selectedWall.id) {
        ctx.strokeStyle = selectedColor;
      } else {
        ctx.strokeStyle = "gray";
      }
    
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();

      if (showUnits) {
        const displayLength = length.toFixed(2);
        const midX = (startX + endX) / 2;
        const midY = (startY + endY) / 2;
        
        const angle = Math.atan2(endY - startY, endX - startX);
        const flip = Math.abs(angle) > Math.PI / 2;
        
        ctx.save();
        ctx.translate(midX, midY);
        ctx.rotate(angle + (flip ? Math.PI : 0));
        ctx.font = `${1 * zoom}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillStyle = "#fff";
        ctx.fillText(`${displayLength}m`, 0, -5);
        ctx.restore();
      }
    });

    // **Draw Nodes**
    ctx.fillStyle = "darkgray";
    nodes.forEach(({ x, y }) => {
      ctx.beginPath();
      ctx.arc(centerX + x * zoom, centerY + y * zoom, 6, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw Access Points as squares
    ctx.fillStyle = "white";
    accessPoints.forEach(ap => {
      const apScreenX = centerX + ap.x * zoom;
      const apScreenY = centerY + ap.y * zoom;
      ctx.beginPath();
      ctx.arc(apScreenX, apScreenY, maxRange * zoom, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(0,255,0,0.2)";
      ctx.lineWidth = 1;
      ctx.stroke();

      const screenX = centerX + ap.x * zoom;
      const screenY = centerY + ap.y * zoom;
      const size = 12;
    
      ctx.fillRect(screenX - size / 2, screenY - size / 2, size, size);

      if (ap.name) {
        ctx.font = `${1 * zoom}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText(ap.name, screenX, screenY - size / 2 - 2);
      }
    });

    // Highlight selected AP
    if (selectedAP) {
      const screenX = centerX + selectedAP.x * zoom;
      const screenY = centerY + selectedAP.y * zoom;
      const size = 16;

      ctx.strokeStyle = selectedColor;
      ctx.lineWidth = 3;
      ctx.strokeRect(screenX - size / 2, screenY - size / 2, size, size);
    }

    drawPreview(preview, ctx, zoom, centerX, centerY, isValidPreview, selectedNode, isAddingNode);

    // ✅ Draw Selected Node Highlight (after normal nodes)
    if (selectedNode) {
      const selectedX = centerX + selectedNode.x * zoom;
      const selectedY = centerY + selectedNode.y * zoom;
    
      // Outline
      ctx.beginPath();
      ctx.arc(selectedX, selectedY, 8, 0, Math.PI * 2);
      ctx.strokeStyle = selectedColor;
      ctx.lineWidth = 3;
      ctx.stroke();
    }

  }, [zoom, offset, showGrid, showRooms, showCoverage, showUnits, nodes, preview, walls, selectedNode, selectedWall, accessPoints, selectedAP, roomShapes]);

  useEffect(() => {
    if (!showCoverage) return;

    const timeout = setTimeout(() => {
      const tiles = [];

      const d0 = 1;
      const pl0 = 30;
      const n = 2.2;
      const txPower = 10;
      const maxRange = 50;
      const gridStep = gridSizes.base / 10;

      const obstructionCache = new Map();
      const makeKey = (apX, apY, gx, gy) => `${apX.toFixed(1)}:${apY.toFixed(1)}:${gx.toFixed(1)},${gy.toFixed(1)}`;

      accessPoints.forEach(ap => {
        const steps = Math.floor(maxRange / gridStep);
        for (let i = -steps; i <= steps; i++) {
          for (let j = -steps; j <= steps; j++) {
            const dx = i * gridStep;
            const dy = j * gridStep;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > maxRange) continue;

            const worldX = ap.x - (gridStep / 2) + dx;
            const worldY = ap.y - (gridStep / 2) + dy;

            const key = makeKey(ap.x, ap.y, worldX, worldY);
            let obstructed = false;

            if (obstructionCache.has(key)) {
              obstructed = obstructionCache.get(key);
            } else {
              obstructed = walls.some(({ a, b }) =>
                getLineIntersection({ x: ap.x, y: ap.y }, { x: worldX, y: worldY }, a, b)
              );
              obstructionCache.set(key, obstructed);
            }

            if (obstructed) continue;

            const pathLoss = pl0 + 10 * n * Math.log10(dist / d0);
            const signal = txPower - pathLoss;

            if (signal > -90) {
              tiles.push({ x: worldX, y: worldY, signal });
            }
          }
        }
      });

      setHeatmapTiles(tiles);
    }, 10);

    return () => clearTimeout(timeout);
  }, [walls, accessPoints, showCoverage]);

  useEffect(() => {
    if (!isLoaded) {
      setIsLoaded(true);
      centerGrid();
    }
  }, [isLoaded]);

  /* Function generated via ChatGPT */
  function getLineIntersection(p1, p2, p3, p4) {
    const denom = (p1.x - p2.x) * (p3.y - p4.y) - 
                  (p1.y - p2.y) * (p3.x - p4.x);
    if (denom === 0) return null; // Parallel lines
  
    const x = ((p1.x * p2.y - p1.y * p2.x) * (p3.x - p4.x) -
               (p1.x - p2.x) * (p3.x * p4.y - p3.y * p4.x)) / denom;
    const y = ((p1.x * p2.y - p1.y * p2.x) * (p3.y - p4.y) -
               (p1.y - p2.y) * (p3.x * p4.y - p3.y * p4.x)) / denom;
  
    const isBetween = (val, a, b) => {
      const min = Math.min(a, b) - 0.01;
      const max = Math.max(a, b) + 0.01;
      return val >= min && val <= max;
    };
  
    if (
      isBetween(x, p1.x, p2.x) && isBetween(x, p3.x, p4.x) &&
      isBetween(y, p1.y, p2.y) && isBetween(y, p3.y, p4.y)
    ) {
      return { x, y };
    }
  
    return null;
  }

  const isAllowedAngle = (dx, dy) => {
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    const absAngle = Math.abs(angle);
    const allowedAngles = [0, 45, 90, 135, 180];
    const epsilon = 0.01;
  
    return allowedAngles.some(a => Math.abs(absAngle - a) < epsilon);
  };  

  const clearSelected = () => {
    setLastAddedNode(null);
    setSelectedNode(null);
    setSelectedWall(null);
    setSelectedAP(null);
  };

  const toggleGrid = () => {
    setShowGrid((prev) => !prev);
  };

  const toggleRooms = () => {
    setShowRooms((prev) => !prev);
  };

  const toggleCoverage = () => {
    setShowCoverage((prev) => !prev);
  };

  const toggleUnits = () => {
    setShowUnits((prev) => !prev);
  };

  const snapToGrid = (x, y) => {
    return {
      x: Math.round(x),
      y: Math.round(y)
    };
  };

  const lastUpdate = useRef(Date.now());
  const handleMouseMove = (event) => {
    const now = Date.now();
    if (now - lastUpdate.current < 16) return; // 60fps max
    lastUpdate.current = now;

    handlePan(event);
    const rect = canvasRef.current.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    // **Convert mouse position to grid-based position**
    const x = (event.clientX - rect.left - centerX - offset.x) / zoom;
    const y = (event.clientY - rect.top - centerY - offset.y) / zoom;

    // **Snap position**
    const snappedPos = snapToGrid(x, y);
    setCursorPos(snappedPos);

    // **Update preview node**
    if (isAddingNode) {
      setPreview({ type: 'node', position: snappedPos });
    
      if (lastAddedNode) {
        const dx = snappedPos.x - lastAddedNode.x;
        const dy = snappedPos.y - lastAddedNode.y;
        setIsValidPreview(isAllowedAngle(dx, dy));
      } else {
        setIsValidPreview(true); // No constraint if no previous node
      }
    } else if (isPlacingAP) {
      setPreview({ type: 'ap', position: snappedPos });
    } else {
      setPreview(null);
    }
  };

  const handleMouseDown = (event) => {

    clearSelected();
    
    if (isPlacingAP) {
      const rect = canvasRef.current.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
    
      const x = (event.clientX - rect.left - centerX - offset.x) / zoom;
      const y = (event.clientY - rect.top - centerY - offset.y) / zoom;
    
      const snapped = snapToGrid(x, y);
    
      if (event.button === 2) {
        // Right-click to delete nearest AP
        const distanceThreshold = 1;
        setAccessPoints(prev => prev.filter(ap => {
          const dist = Math.hypot(ap.x - snapped.x, ap.y - snapped.y);
          return dist > distanceThreshold;
        }));
      } else if (event.button === 0) {
        // Left-click to add new AP
        setAccessPoints(prev => {
          const newName = `Access Point #${accessPoints.length + 1}`;
          return [...prev, { x: snapped.x, y: snapped.y, name: newName }];
        });
      }
    
      return;
    }

    if (event.button === 1) {
      startPan(event);
    }

    if (event.button !== 0) return; // Left click only

    if (isPanning) {
      startPan(event);
      return;
    }

    if (isSelecting) {
      startSelect(event);
      return;
    }

    if (isTestingSignal) {
      // TODO: Implement signal testing logic
      console.log("Testing signal...");
      return;
    }
  
    if (isAddingNode && event.shiftKey) {
      deleteNode(event);
    } else if (isAddingNode) {
      addNode(event);
    }
  };

  // 🔹 Function to add a node at cursor position
  const addNode = (event) => {
    saveStateToHistory();
    const rect = canvasRef.current.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
  
    const x = (event.clientX - rect.left - centerX - offset.x) / zoom;
    const y = (event.clientY - rect.top - centerY - offset.y) / zoom;
  
    const snappedPos = snapToGrid(x, y);
    setCursorPos(snappedPos);
  
    const existingNode = nodes.find(node => node.x === snappedPos.x && node.y === snappedPos.y);
    const newNode = existingNode || { id: uuidv4(), x: snappedPos.x, y: snappedPos.y };
  
    // Prevent linking same node to itself
    if (lastAddedNode && newNode.x === lastAddedNode.x && newNode.y === lastAddedNode.y) {
      clearSelected();
      return;
    }
  
    // Ensure angle is allowed
    if (lastAddedNode) {
      const dx = newNode.x - lastAddedNode.x;
      const dy = newNode.y - lastAddedNode.y;
      if (!isAllowedAngle(dx, dy)) {
        showToast('⛔ Node must be placed at 45° or 90° angle.')
        return;
      }
    }
  
    const newWalls = lastAddedNode
      ? [{
          id: uuidv4(),
          a: lastAddedNode,
          b: newNode,
          config: { material: 'drywall', thickness: 10 }
        }]
      : [];
    let updatedNodes = [...nodes];
    let updatedWalls = [...walls];
  
    const isSameWall = (w1, w2) => {
      const norm = ({ a, b }) => (a.x < b.x || (a.x === b.x && a.y < b.y)) ? [a, b] : [b, a];
      const [a1, b1] = norm(w1);
      const [a2, b2] = norm(Array.isArray(w2) ? { a: w2[0], b: w2[1] } : w2);
      return a1.x === a2.x && a1.y === a2.y && b1.x === b2.x && b1.y === b2.y;
    };
  
    if (lastAddedNode) {
      walls.forEach(({ a, b }) => {
        const intersection = getLineIntersection(a, b, lastAddedNode, newNode);
        if (intersection) {
          const snapped = snapToGrid(intersection.x, intersection.y);
          const exists = updatedNodes.some(n => n.x === snapped.x && n.y === snapped.y);
  
          if (!exists) {
            updatedNodes.push({ id: uuidv4(), x: snapped.x, y: snapped.y });
          }
  
          updatedWalls = updatedWalls.filter(w => !isSameWall(w, [a, b]));
          if (a.x !== snapped.x || a.y !== snapped.y) {
            updatedWalls.push({ id: uuidv4(), a, b: snapped, config: { material: 'drywall', thickness: 10 } });
          }
          if (snapped.x !== b.x || snapped.y !== b.y) {
            updatedWalls.push({ id: uuidv4(), a: snapped, b, config: { material: 'drywall', thickness: 10 } });
          }
  
          if (newWalls.length) newWalls.pop();
          if (lastAddedNode.x !== snapped.x || lastAddedNode.y !== snapped.y) {
            newWalls.push({ id: uuidv4(), a: lastAddedNode, b: snapped, config: { material: 'drywall', thickness: 10 } });
          }
          if (snapped.x !== newNode.x || snapped.y !== newNode.y) {
            newWalls.push({
              id: uuidv4(),
              a: snapped,
              b: newNode,
              config: { material: 'drywall', thickness: 10 }
            });
          }
        }
      });
    }
  
    // Only add the node if it doesn't already exist
    if (!existingNode) {
      updatedNodes.push(newNode);
    }
  
    setNodes(updatedNodes);
    setWalls([...updatedWalls, ...newWalls]);
    setLastAddedNode(newNode);
    setSelectedNode(newNode);
  };

  const deleteNode = (event) => {
    saveStateToHistory();
    if (!canvasRef.current) return;
  
    const rect = canvasRef.current.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
  
    // Get the mouse position in grid coordinates
    const x = Math.round((event.clientX - rect.left - centerX - offset.x) / zoom);
    const y = Math.round((event.clientY - rect.top - centerY - offset.y) / zoom);
  
    // Snap the deleted node to the grid
    const snappedPos = snapToGrid(x, y);
  
    // Filter out the node that was clicked on
    setNodes((prevNodes) => {
      const threshold = 0.5;
      return prevNodes.filter(node => {
        const distance = Math.sqrt((node.x - snappedPos.x) ** 2 + (node.y - snappedPos.y) ** 2);
        return distance > threshold;  // Allows for some margin for error in node position
      });
    });
  
    // Remove walls related to the deleted node
    setWalls((prevWalls) => {
      return prevWalls.filter(({ a: startNode, b: endNode }) => {
        // Define match threshold for node-wall matching
        const matchThreshold = 1;
        const isStartNodeMatched = Math.abs(startNode.x - snappedPos.x) < matchThreshold && Math.abs(startNode.y - snappedPos.y) < matchThreshold;
        const isEndNodeMatched = Math.abs(endNode.x - snappedPos.x) < matchThreshold && Math.abs(endNode.y - snappedPos.y) < matchThreshold;

        return !(isStartNodeMatched || isEndNodeMatched); // Only keep walls that don't match the deleted node
      });
    });
  };

  const startPan = (event) => {
    setIsDragging(true);
    dragStart.current = { x: event.clientX, y: event.clientY };

    const canvas = document.querySelector('.grid-canvas');
    canvas.style.cursor = "grabbing";
  };

  function distanceToSegment(p, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    if (dx === 0 && dy === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
    const projX = a.x + t * dx;
    const projY = a.y + t * dy;
    return Math.hypot(p.x - projX, p.y - projY);
  }

  const handleUndo = () => {
    if (history.length === 0) return;
    const last = history[history.length - 1];
    clearSelected();
    setRedoStack((r) => [...r, { nodes, walls }]);
    setHistory((h) => h.slice(0, h.length - 1));
    setNodes(last.nodes);
    setWalls(last.walls);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const last = redoStack[redoStack.length - 1];
    clearSelected();
    setHistory((h) => [...h, { nodes, walls }]);
    setRedoStack((r) => r.slice(0, r.length - 1));
    setNodes(last.nodes);
    setWalls(last.walls);
  };

  function getNodeAtPoint(x, y, nodes) {
    const threshold = 0.5;
    for (const node of nodes) {
      const dist = Math.hypot(node.x - x, node.y - y);
      if (dist <= threshold) return { ...node };
    }
    return null;
  }
  
  function getWallAtPoint(x, y, walls) {
    const threshold = 0.5;
  
    for (let i = 0; i < walls.length; i++) {
      const wall = walls[i];
      const { a, b } = wall;
  
      const dist = distanceToSegment({ x, y }, a, b);
      if (dist < threshold) return wall;
    }
  
    return null;
  }

  function getAPAtPoint(x, y, accessPoints) {
    const threshold = 0.5;

    for (const ap of accessPoints) {
      const dist = Math.hypot(ap.x - x, ap.y - y);
      if (dist <= threshold) return ap;
    }
    return null;
  }

  const startSelect = (event) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
  
    const x = (event.clientX - rect.left - centerX - offset.x) / zoom;
    const y = (event.clientY - rect.top - centerY - offset.y) / zoom;
  
    const clickedNode = getNodeAtPoint(x, y, nodes);
    console.log("Clicked node:", clickedNode);

    const clickedWall = getWallAtPoint(x, y, walls);
    console.log("Clicked wall:", clickedWall);

    const clickedAP = getAPAtPoint(x, y, accessPoints);
    console.log("Clicked AP:", clickedAP);

    if (clickedNode) {
      setSelectedNode(clickedNode);
      openConfigSidebar();
      return;
    }
    else if (clickedWall) {
      setSelectedWall(clickedWall);
      openConfigSidebar();
      return;
    }
    else if (clickedAP) {
      setSelectedAP(clickedAP);
      openConfigSidebar();
      return;
    }
    else {
      clearSelected();
    }
  };

  const handlePan = (event) => {
    if (!isDragging) return;

    setOffset({
      x: offset.x + (event.clientX - dragStart.current.x),
      y: offset.y + (event.clientY - dragStart.current.y),
    });

    dragStart.current = { x: event.clientX, y: event.clientY };
  };

  const stopPan = () => {
    const canvas = document.querySelector('.grid-canvas');
    canvas.style.cursor = "pointer";
    setIsDragging(false);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        clearSelected();
      }
      else if (e.ctrlKey && e.key === "z") {
        e.preventDefault();
        handleUndo();
      } else if (e.ctrlKey && (e.key === "y" || (e.shiftKey && e.key === "Z"))) {
        e.preventDefault();
        handleRedo();
    } else if (e.key === "Backspace") {
      e.preventDefault();
      if (selectedNode) {
        saveStateToHistory();
      
        setNodes((prevNodes) => prevNodes.filter(node => node.id !== selectedNode.id));

        setWalls((prevWalls) => prevWalls.filter(({ a, b }) => a.id !== selectedNode.id && b.id !== selectedNode.id));
      
        setSelectedNode(null);
      } else if (selectedWall) {
        setWalls(prev => prev.filter(w => w.id !== selectedWall.id));
        setSelectedWall(null);
      }
    }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedNode, selectedWall, nodes, walls, history, redoStack]);

  const centerGrid = () => {
    const newCenterX = window.innerWidth / 2;
    const newCenterY = window.innerHeight / 2;
  
    setOffset({
      x: -newCenterX,
      y: -newCenterY,
    });
  };  

  const handleDoubleClick = () => {
    centerGrid();
  };

  return (
    <div className="workspace">
      {/* Grid */}
      <div
        className="canvas-container"
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={stopPan}
        onMouseLeave={stopPan}
        onDoubleClick={handleDoubleClick}
      >
        <canvas ref={canvasRef} className="grid-canvas" onContextMenu={(e) => e.preventDefault()}></canvas>
      </div>

      <div className="canvas-toggle-buttons">
        <button onClick={toggleGrid}>
          {showGrid ? "Hide Grid" : "Show Grid"}
        </button>

        <button onClick={toggleRooms}>
          {showRooms ? "Hide Rooms" : "Show Rooms"}
        </button>

        <button onClick={toggleCoverage}>
          {showCoverage ? "Hide Coverage" : "Show Coverage"}
        </button>

        <button onClick={toggleUnits}>
          {showUnits ? "Hide Units" : "Show Units"}
        </button>
      </div>

      <div className="upperBottomContainer">
          <button className="corner-box" onClick={handleUndo}>Undo</button>
          <button className="corner-box" onClick={handleRedo}>Redo</button>
      </div>
      
      <div className="bottomContainer">
        <div className="corner-box">
            X: {cursorPos.x}m, Y: {cursorPos.y}m
        </div>

        <div className="corner-box">
          {roomShapes.length === 1 
            ? `${roomShapes.length} Room`
            : `${roomShapes.length} Rooms`}
        </div>

        <div className="corner-box">
          Zoom: {Math.round(zoom * 100) / 100}x
        </div>
      </div>
    </div>
  );
};

export default CanvasGrid;
