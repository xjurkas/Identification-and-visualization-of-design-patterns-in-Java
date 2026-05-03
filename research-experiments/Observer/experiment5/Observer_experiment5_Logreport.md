Observer — Experiment 5: combination disjunctions
Date: 2026-04-29 15:30:59
Rule: Experiment 3 + (notify method or CALLS to Observer method or update-prefix to Observer)

quickuml: 0 subject(s), 0 observer(s)

lexi: 0 subject(s), 0 observer(s)

jrefac: 3 subject(s), 3 observer(s)
  - [Subject] org.acm.seguin.refactor.ComplexTransform
  - [Subject] org.acm.seguin.uml.line.LinedPanel
  - [Subject] org.acm.seguin.uml.loader.ReloaderSingleton
  - [Observer] org.acm.seguin.refactor.TransformAST
  - [Observer] org.acm.seguin.uml.line.EndPointPanel
  - [Observer] org.acm.seguin.uml.loader.Reloader

netbeans: 49 subject(s), 44 observer(s)
  - [Subject] org.openidex.search.Scanner
  - [Subject] org.openide.awt.SpinButton
  - [Subject] org.openide.awt.InnerLayout
  - [Subject] org.openide.compiler.ExternalCompilerGroup
  - [Subject] org.openide.explorer.propertysheet.PropertyDisplayer
  - [Subject] org.openide.explorer.propertysheet.SheetButton
  - [Subject] org.openide.explorer.propertysheet.PropertyShow
  - [Subject] org.openide.explorer.view.VisualizerNode
  - [Subject] org.openide.loaders.DataLoaderPool
  - [Subject] org.openide.loaders.ModifiedRegistry
  - [Subject] org.openide.loaders.DataObjectPool
  - [Subject] org.openide.src.Memory
  - [Subject] org.openide.util.datatransfer.ExTransferable
  - [Subject] org.openide.windows.Ref
  - [Subject] org.openidex.projects.AbstractSettingsSet
  - [Subject] org.netbeans.core.windows.WindowManagerImpl
  - [Subject] org.netbeans.core.awt.ButtonBar
  - [Subject] org.netbeans.core.awt.PageControl
  - [Subject] org.netbeans.core.execution.ExecutionEngine
  - [Subject] org.openide.awt.SplittedPanel
  - [Subject] org.openide.options.ControlPanel
  - [Subject] org.netbeans.core.InstanceLevel
  - [Subject] org.netbeans.core.windows.StateManager
  - [Subject] org.netbeans.core.windows.MultiTabContainer
  - [Subject] org.netbeans.core.windows.WorkspaceImpl
  - [Subject] org.netbeans.editor.ExtUI
  - [Subject] org.netbeans.editor.BaseDocument
  - [Subject] org.netbeans.editor.ext.JCBaseFinder
  - [Subject] org.netbeans.examples.lib.timerbean.Timer
  - [Subject] org.openide.loaders.MultiDataObject
  - [Subject] org.openide.util.Task
  - [Subject] org.netbeans.modules.emacs.Connection
  - [Subject] org.netbeans.lib.ddl.util.CommandBuffer
  - [Subject] org.openide.src.ClassElement
  - [Subject] org.netbeans.modules.corba.IDLDataLoader
  - [Subject] org.netbeans.modules.debugger.support.AbstractDebugger
  - [Subject] org.netbeans.modules.debugger.support.AbstractThreadGroup
  - [Subject] org.netbeans.modules.debugger.support.util.Validator
  - [Subject] org.netbeans.modules.debugger.delegator.DelegatingBreakpoint
  - [Subject] org.netbeans.modules.debugger.delegator.DelegatingDebugger
  - [Subject] org.netbeans.modules.debugger.support.DebuggerModule
  - [Subject] org.openide.filesystems.Repository
  - [Subject] org.netbeans.modules.editor.KitSupport
  - [Subject] org.netbeans.modules.form.FormManager2
  - [Subject] org.netbeans.modules.jarpackager.JarCreater
  - [Subject] org.netbeans.modules.jarpackager.util.JarInspector
  - [Subject] org.netbeans.modules.java.JavaDataObject
  - [Subject] org.openide.loaders.ConnectionSupport
  - [Subject] org.netbeans.modules.jndi.utils.Refreshd
  - [Observer] org.netbeans.core.awt.ButtonBarListener
  - [Observer] org.netbeans.core.execution.ExecutionListener
  - [Observer] org.netbeans.core.windows.ContainerListener
  - [Observer] org.netbeans.core.windows.StateListener
  - [Observer] org.netbeans.core.windows.TopComponentListener
  - [Observer] org.netbeans.editor.DrawLayer
  - [Observer] org.netbeans.editor.ext.JCPackage
  - [Observer] org.netbeans.examples.lib.timerbean.TimerListener
  - [Observer] org.netbeans.lib.ddl.DDLCommand
  - [Observer] org.netbeans.modules.debugger.delegator.SessionsListener
  - [Observer] org.netbeans.modules.debugger.support.AbstractDebugger
  - [Observer] org.netbeans.modules.debugger.support.AbstractThread
  - [Observer] org.netbeans.modules.debugger.support.DebuggerListener
  - [Observer] org.netbeans.modules.debugger.support.ThreadGroupListener
  - [Observer] org.netbeans.modules.debugger.support.util.Object
  - [Observer] org.netbeans.modules.emacs.EmacsListener
  - [Observer] org.netbeans.modules.form.ComponentContainer
  - [Observer] org.netbeans.modules.form.FormListener
  - [Observer] org.netbeans.modules.jarpackager.util.ProgressListener
  - [Observer] org.netbeans.modules.jndi.utils.APCTarget
  - [Observer] org.openide.ServiceType
  - [Observer] org.openide.awt.SpinButtonListener
  - [Observer] org.openide.awt.SplitChangeListener
  - [Observer] org.openide.compiler.Compiler
  - [Observer] org.openide.explorer.propertysheet.SheetButtonListener
  - [Observer] org.openide.explorer.view.NodeModel
  - [Observer] org.openide.filesystems.FileObject
  - [Observer] org.openide.filesystems.FileSystem
  - [Observer] org.openide.filesystems.RepositoryListener
  - [Observer] org.openide.loaders.DataLoader
  - [Observer] org.openide.loaders.DataObject
  - [Observer] org.openide.loaders.Entry
  - [Observer] org.openide.loaders.OperationListener
  - [Observer] org.openide.nodes.Node
  - [Observer] org.openide.options.SystemOption
  - [Observer] org.openide.src.Element
  - [Observer] org.openide.src.Finder
  - [Observer] org.openide.util.SharedClassObject
  - [Observer] org.openide.util.TaskListener
  - [Observer] org.openide.util.datatransfer.TransferListener
  - [Observer] org.openide.windows.CloneableTopComponent
  - [Observer] org.openide.windows.Component
  - [Observer] org.openide.windows.Mode
  - [Observer] org.openidex.search.ScannerListener

junit: 3 subject(s), 2 observer(s)
  - [Subject] junit.awtui.TestRunner
  - [Subject] junit.framework.TestResult
  - [Subject] junit.swingui.TestTreeModel
  - [Observer] junit.framework.Test
  - [Observer] junit.framework.TestListener

jhotdraw: 2 subject(s), 3 observer(s)
  - [Subject] CH.ifa.draw.standard.AbstractFigure
  - [Subject] CH.ifa.draw.standard.StandardDrawingView
  - [Observer] CH.ifa.draw.framework.Figure
  - [Observer] CH.ifa.draw.framework.FigureChangeListener
  - [Observer] CH.ifa.draw.framework.Painter

mapper: 5 subject(s), 11 observer(s)
  - [Subject] com.taursys.xml.Component
  - [Subject] com.taursys.swing.MComboBoxModel
  - [Subject] com.taursys.swing.MDocument
  - [Subject] com.taursys.xml.event.Dispatcher
  - [Subject] com.taursys.xml.Form
  - [Observer] com.taursys.swing.EnableListener
  - [Observer] com.taursys.xml.Component
  - [Observer] com.taursys.xml.event.CloseFormListener
  - [Observer] com.taursys.xml.event.InitContextListener
  - [Observer] com.taursys.xml.event.InitFormListener
  - [Observer] com.taursys.xml.event.InputListener
  - [Observer] com.taursys.xml.event.OpenFormListener
  - [Observer] com.taursys.xml.event.ParameterListener
  - [Observer] com.taursys.xml.event.RecycleListener
  - [Observer] com.taursys.xml.event.RenderListener
  - [Observer] com.taursys.xml.event.TriggerListener

nutch: 0 subject(s), 0 observer(s)

PMD: 3 subject(s), 3 observer(s)
  - [Subject] net.sourceforge.pmd.Report
  - [Subject] net.sourceforge.pmd.RuleSet
  - [Subject] net.sourceforge.pmd.util.viewer.model.ViewerModel
  - [Observer] net.sourceforge.pmd.ReportListener
  - [Observer] net.sourceforge.pmd.Rule
  - [Observer] net.sourceforge.pmd.util.viewer.model.ViewerModelListener