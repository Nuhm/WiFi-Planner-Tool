import { useEffect, useState } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { useLocation, useNavigate } from 'react-router-dom';
import Canvas from '../../components/Canvas/Canvas';
import ConfigSidebar from '../../components/Sidebars/ConfigSidebar';
import ProjectSidebar from '../../components/Sidebars/ProjectSidebar';
import { useToast } from '../../components/Toast/ToastContext';
import { Toolbar } from '../../components/Toolbar/Toolbar';
import { TOOL_MODES } from '../../constants/toolModes';
import './Workspace.css';

/**
 * Main workspace view for editing a project.
 *
 * - Loads canvas/project data and saves changes to localStorage
 * - Manages tool modes, selection, canvas state, and sidebars
 * - Uses resizable layout for canvas and configuration panels
 */
const Workspace = () => {
	const navigate = useNavigate();
	const location = useLocation();
	const { state: project } = location;
	const projectId = project.id;
	// --- Project data state ---
	const [projectName, setProjectName] = useState(project.name);
	const [projectDescription, setProjectDescription] = useState(
		project.description || ''
	);
	const [isLoaded, setIsLoaded] = useState(false);
	// --- Sidebar visibility state ---
	const [showProjectSidebar, setShowProjectSidebar] = useState(false);
	const [showConfigSidebar, setShowConfigSidebar] = useState(false);
	const [mode, setMode] = useState({
		[TOOL_MODES.PAN]: false,
		[TOOL_MODES.SELECT]: false,
		[TOOL_MODES.ADD_NODE]: false,
		[TOOL_MODES.TEST_SIGNAL]: false,
		[TOOL_MODES.PLACE_AP]: false,
	});
	const { showToast } = useToast();

	const toggleMode = (key) => {
		setMode((prev) => ({ ...prev, [key]: !prev[key] }));
	};

	const deselectButtons = () => {
		setMode({
			[TOOL_MODES.PAN]: false,
			[TOOL_MODES.SELECT]: false,
			[TOOL_MODES.ADD_NODE]: false,
			[TOOL_MODES.TEST_SIGNAL]: false,
			[TOOL_MODES.PLACE_AP]: false,
		});
	};

	const closeAllSidebars = () => {
		setShowProjectSidebar(false);
		setShowConfigSidebar(false);
	};

	// --- Canvas element state ---
	const [nodes, setNodes] = useState([]);
	const [walls, setWalls] = useState([]);
	const [accessPoints, setAccessPoints] = useState([]);

	// --- Selection state ---
	const [lastAddedNode, setLastAddedNode] = useState(null);
	const [selected, setSelected] = useState({
		node: null,
		wall: null,
		ap: null,
	});

	const clearSelected = () => {
		setSelected({ node: null, wall: null, ap: null });
		setLastAddedNode(null);
	};

	// Load canvas data from localStorage on mount
	useEffect(() => {
		const savedData = localStorage.getItem(`canvasData-${projectId}`);
		if (savedData) {
			const parsedData = JSON.parse(savedData);
			setNodes(parsedData.nodes || []);
			setWalls(parsedData.walls || []);
			setAccessPoints(parsedData.accessPoints || []);
		}
		setIsLoaded(true);
	}, [projectId]);

	// Show toast when wall tool is active
	useEffect(() => {
		if (mode.isAddingNode) {
			showToast('Wall Tool active — Shift+Click a wall node to delete');
		}
	}, [mode.isAddingNode, showToast]);

	// Persist project name/description to localStorage
	useEffect(() => {
		const allProjects = JSON.parse(localStorage.getItem('projects')) || [];
		const now = new Date().toISOString();
		const updatedProjects = allProjects.map((p) =>
			p.id === projectId
				? {
						...p,
						name: projectName,
						description: projectDescription,
						lastEdited: now,
				  }
				: p
		);
		localStorage.setItem('projects', JSON.stringify(updatedProjects));
	}, [projectName, projectDescription, projectId]);

	// Auto-save canvas data to localStorage after load and on changes
	useEffect(() => {
		if (isLoaded) {
			const data = { nodes, walls, accessPoints };
			localStorage.setItem(`canvasData-${projectId}`, JSON.stringify(data));
			// Update lastEdited timestamp
			const allProjects = JSON.parse(localStorage.getItem('projects')) || [];
			const now = new Date().toISOString();
			const updatedProjects = allProjects.map((p) =>
				p.id === projectId ? { ...p, lastEdited: now } : p
			);
			localStorage.setItem('projects', JSON.stringify(updatedProjects));
		}
	}, [isLoaded, nodes, walls, accessPoints, projectId]);

	// Clear all grid/canvas data
	const clearGrid = () => {
		const confirmClear = window.confirm(
			'Are you sure you want to clear all walls, nodes, and access points?'
		);
		if (!confirmClear) return;
		setNodes([]);
		setWalls([]);
		setAccessPoints([]);
		deselectButtons();
		clearSelected();
	};

	const updateElementConfig = (type, key, value, isTopLevel = false) => {
		if (type === 'ap' && selected.ap) {
			setAccessPoints((prev) => {
				const updated = prev.map((ap) =>
					ap.id === selected.ap.id
						? isTopLevel
							? { ...ap, [key]: value }
							: { ...ap, config: { ...ap.config, [key]: value } }
						: ap
				);
				const newAP = updated.find((ap) => ap.id === selected.ap.id);
				setSelected((prev) => ({ ...prev, ap: newAP ?? null }));
				return updated;
			});
		}

		if (type === 'wall' && selected.wall) {
			setWalls((prev) => {
				const updated = prev.map((wall) =>
					wall.id === selected.wall.id
						? {
								...wall,
								config: {
									...wall.config,
									[key]: value,
								},
						  }
						: wall
				);
				const newWall = updated.find((wall) => wall.id === selected.wall.id);
				setSelected((prev) => ({ ...prev, wall: newWall ?? null }));
				return updated;
			});
		}
	};

	return (
		<div className="workspaceContainer">
			<PanelGroup direction="horizontal">
				{/* Left Side: Canvas */}
				<Panel
					defaultSize={showProjectSidebar ? 70 : 100}
					minSize={50}
					className="canvasArea"
				>
					<div className="LeftButtonsContainer">
						<Toolbar
							mode={mode}
							toggleMode={toggleMode}
							deselectButtons={deselectButtons}
							clearGrid={clearGrid}
							navigate={navigate}
						/>
					</div>

					<div className="RightButtonsContainer">
						<button
							className="canvasSidebarButton canvasOverlayButton"
							onClick={() => {
								setShowConfigSidebar(false);
								setShowProjectSidebar(true);
							}}
						>
							⚙️ Project Settings
						</button>

						<button
							className="canvasSidebarButton canvasOverlayButton"
							onClick={() => {
								setShowProjectSidebar(false);
								setShowConfigSidebar(true);
							}}
						>
							⚙️ Configuration
						</button>
					</div>

					<Canvas
						mode={mode}
						nodes={nodes}
						setNodes={setNodes}
						walls={walls}
						setWalls={setWalls}
						selected={selected}
						setSelected={setSelected}
						accessPoints={accessPoints}
						setAccessPoints={setAccessPoints}
						openConfigSidebar={() => {
							setShowProjectSidebar(false);
							setShowConfigSidebar(true);
						}}
						lastAddedNode={lastAddedNode}
						setLastAddedNode={setLastAddedNode}
					/>
				</Panel>

				{/* Resizer Handle: Only visible when any sidebar is open */}
				{(showProjectSidebar || showConfigSidebar) && (
					<PanelResizeHandle className="resizer" />
				)}

				{/* Right Side: Project Settings or Configuration Sidebar */}
				{(showProjectSidebar || showConfigSidebar) && (
					<Panel
						defaultSize={20}
						minSize={20}
						maxSize={50}
						className="sidebar"
						style={{ overflowY: 'auto' }}
					>
						<div className="sidebarContent">
							{showProjectSidebar && (
								<ProjectSidebar
									projectName={projectName}
									setProjectName={setProjectName}
									projectDescription={projectDescription}
									setProjectDescription={setProjectDescription}
									onClose={closeAllSidebars}
								/>
							)}

							{showConfigSidebar && (
								<ConfigSidebar
									selected={selected}
									setSelected={setSelected}
									setWalls={setWalls}
									setAccessPoints={setAccessPoints}
									updateElementConfig={updateElementConfig}
									onClose={closeAllSidebars}
								/>
							)}
						</div>
					</Panel>
				)}
			</PanelGroup>
		</div>
	);
};

export default Workspace;
