import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import CanvasGrid from "../components/CanvasGrid";
import "../styles/Workspace.css";

const Workspace = () => {
  const navigate = useNavigate();
  const [isProjectSidebarOpen, setIsProjectSidebarOpen] = useState(false);
  const [isBlueprintSidebarOpen, setIsBlueprintSidebarOpen] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [isAddingNode, setIsAddingNode] = useState(false);
  const [isDeletingNode, setIsDeletingNode] = useState(false);
  const [isWallBuilder, setIsWallBuilder] = useState(false);
  const [nodes, setNodes] = useState([]);

  const clearNodes = () => {
    setNodes([]); // Reset the nodes array
    deselectButtons();
  };

  const deselectButtons = () => {
    setIsAddingNode(false);
    setIsDeletingNode(false);
    setIsPanning(false);
    setIsWallBuilder(false);
  }

  return (
    <div className="workspace-container">
      
      {/* 🔥 Exit Button (Top-Left Corner) */}
      <button className="exit-button" onClick={() => navigate("/")}>
        ✖ Exit
      </button>

      <PanelGroup direction="horizontal">
        
        {/* Left Side: Canvas */}
        <Panel 
          defaultSize={isProjectSidebarOpen || isBlueprintSidebarOpen ? 70 : 100} 
          minSize={50} 
          className="canvas-area"
        >
          <CanvasGrid 
            isSidebarOpen={isProjectSidebarOpen || isBlueprintSidebarOpen} 
            sidebarWidth={300}
            isPanning = {isPanning}
            isAddingNode={isAddingNode}
            isDeletingNode={isDeletingNode}
            isWallBuilder={isWallBuilder}
            nodes={nodes}
            setNodes={setNodes}
          />
          
          <div>
            {/* 🔥 Floating "Project Settings" Button */}
            {!isProjectSidebarOpen && !isBlueprintSidebarOpen && (
              <button className="project-settings-button" onClick={() => setIsProjectSidebarOpen(true)}>
                ⚙️ Project Settings
              </button>
            )}

            {/* 🔥 Floating "Blueprint Editor" Button (Below Project Settings) */}
            {!isProjectSidebarOpen && !isBlueprintSidebarOpen && (
              <button
                className="blueprint-editor-button"
                onClick={() => setIsBlueprintSidebarOpen(true)}
              >
                📐 Blueprint Editor
              </button>
            )}
          </div>
        </Panel>

        {/* Resizer Handle (Only visible when any sidebar is open) */}
        {(isProjectSidebarOpen || isBlueprintSidebarOpen) && <PanelResizeHandle className="resizer" />}

        {/* 🔥 Right Side: Project Settings Sidebar */}
        {isProjectSidebarOpen && (
          <Panel defaultSize={30} minSize={20} maxSize={50} className="sidebar">
            <div className="sidebar-content">
              
              {/* 🔥 Close Sidebar Button */}
              <button className="close-sidebar-button" onClick={() => setIsProjectSidebarOpen(false)}>
                ✖ Close
              </button>

              <h3>Project Settings</h3>

              <label>Project Name:</label>
              <input type="text" className="input-field" />

              <label>Project Description:</label>
              <textarea className="input-field" rows="3"></textarea>
            </div>
          </Panel>
        )}

        {/* 🔥 Right Side: Blueprint Editor Sidebar */}
        {isBlueprintSidebarOpen && (
          <Panel defaultSize={30} minSize={20} maxSize={50} className="sidebar">
            <div className="sidebar-content">
              
              {/* 🔥 Close Sidebar Button */}
              <button className="close-sidebar-button" onClick={() => setIsBlueprintSidebarOpen(false)}>
                ✖ Close
              </button>

              <h3>Blueprint Editor</h3>
              
              {/* 📌 Toolbar for Wall Nodes */}
              <div className="toolbar">
                <button 
                    className={`toolbar-button ${isPanning ? "active" : ""}`} 
                    onClick={() => {
                        deselectButtons();
                        setIsPanning(!isPanning);
                    }}
                >
                    ✖️ Panning Tool
                </button>
                <button 
                    className={`toolbar-button ${isAddingNode ? "active" : ""}`} 
                    onClick={() => {
                        deselectButtons();
                        setIsAddingNode(!isAddingNode);
                    }}
                >
                    ➕ Add Node
                </button>
                
                <button 
                    className={`toolbar-button ${isDeletingNode ? "active" : ""}`} 
                    onClick={() => {
                        deselectButtons();
                        setIsDeletingNode(!isDeletingNode);
                    }}
                >
                    🗑️ Delete Node
                </button>

                <button 
                    className={`toolbar-button ${isWallBuilder ? "active" : ""}`} 
                    onClick={() => {
                      deselectButtons();
                      setIsWallBuilder(!isWallBuilder);
                  }}
                >
                    🧱 Wall Tool
                </button>
                
                <button 
                    className="toolbar-button clear" 
                    onClick={clearNodes}
                >
                    🧹 Clear
                </button>

              </div>
            </div>
          </Panel>
        )}
      </PanelGroup>
    </div>
  );
};

export default Workspace;
