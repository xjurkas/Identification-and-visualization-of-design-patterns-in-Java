Observer — Experiment 4: Notify method
Date: 2026-04-29 15:29:38
Rule: Experiment 3 + Subject has method with prefix notify/fire/changed/publish/broadcast/dispatch

quickuml: 0 subject(s), 0 observer(s)

lexi: 0 subject(s), 0 observer(s)

jrefac: 0 subject(s), 0 observer(s)

netbeans: 29 subject(s), 30 observer(s)
  - [Subject] org.openide.awt.SpinButton
  - [Subject] org.openide.compiler.ExternalCompilerGroup
  - [Subject] org.openide.explorer.propertysheet.PropertyDisplayer
  - [Subject] org.openide.explorer.propertysheet.SheetButton
  - [Subject] org.openide.explorer.propertysheet.PropertyShow
  - [Subject] org.openide.explorer.view.VisualizerNode
  - [Subject] org.openide.loaders.DataLoaderPool
  - [Subject] org.openide.loaders.ModifiedRegistry
  - [Subject] org.openide.src.Memory
  - [Subject] org.openide.util.datatransfer.ExTransferable
  - [Subject] org.netbeans.core.awt.PageControl
  - [Subject] org.netbeans.core.execution.ExecutionEngine
  - [Subject] org.openide.awt.SplittedPanel
  - [Subject] org.netbeans.core.windows.StateManager
  - [Subject] org.netbeans.core.windows.MultiTabContainer
  - [Subject] org.netbeans.editor.ExtUI
  - [Subject] org.netbeans.examples.lib.timerbean.Timer
  - [Subject] org.openide.loaders.MultiDataObject
  - [Subject] org.openide.util.Task
  - [Subject] org.netbeans.modules.debugger.support.AbstractDebugger
  - [Subject] org.netbeans.modules.debugger.support.AbstractThreadGroup
  - [Subject] org.netbeans.modules.debugger.delegator.DelegatingBreakpoint
  - [Subject] org.netbeans.modules.debugger.delegator.DelegatingDebugger
  - [Subject] org.openide.filesystems.Repository
  - [Subject] org.netbeans.modules.form.FormManager2
  - [Subject] org.netbeans.modules.jarpackager.JarCreater
  - [Subject] org.netbeans.modules.jarpackager.util.JarInspector
  - [Subject] org.openide.loaders.ConnectionSupport
  - [Subject] org.openidex.search.Scanner
  - [Observer] org.netbeans.core.execution.ExecutionListener
  - [Observer] org.netbeans.core.windows.ContainerListener
  - [Observer] org.netbeans.core.windows.StateListener
  - [Observer] org.netbeans.editor.DrawLayer
  - [Observer] org.netbeans.examples.lib.timerbean.TimerListener
  - [Observer] org.netbeans.modules.debugger.delegator.SessionsListener
  - [Observer] org.netbeans.modules.debugger.support.AbstractDebugger
  - [Observer] org.netbeans.modules.debugger.support.AbstractThread
  - [Observer] org.netbeans.modules.debugger.support.DebuggerListener
  - [Observer] org.netbeans.modules.debugger.support.ThreadGroupListener
  - [Observer] org.netbeans.modules.debugger.support.util.Object
  - [Observer] org.netbeans.modules.form.ComponentContainer
  - [Observer] org.netbeans.modules.form.FormListener
  - [Observer] org.netbeans.modules.jarpackager.util.ProgressListener
  - [Observer] org.openide.awt.SpinButtonListener
  - [Observer] org.openide.awt.SplitChangeListener
  - [Observer] org.openide.compiler.Compiler
  - [Observer] org.openide.explorer.propertysheet.SheetButtonListener
  - [Observer] org.openide.explorer.view.NodeModel
  - [Observer] org.openide.filesystems.FileObject
  - [Observer] org.openide.filesystems.FileSystem
  - [Observer] org.openide.filesystems.RepositoryListener
  - [Observer] org.openide.loaders.Entry
  - [Observer] org.openide.loaders.OperationListener
  - [Observer] org.openide.nodes.Node
  - [Observer] org.openide.src.Element
  - [Observer] org.openide.util.TaskListener
  - [Observer] org.openide.util.datatransfer.TransferListener
  - [Observer] org.openide.windows.Component
  - [Observer] org.openidex.search.ScannerListener

junit: 1 subject(s), 1 observer(s)
  - [Subject] junit.swingui.TestTreeModel
  - [Observer] junit.framework.Test

jhotdraw: 1 subject(s), 1 observer(s)
  - [Subject] CH.ifa.draw.standard.AbstractFigure
  - [Observer] CH.ifa.draw.framework.FigureChangeListener

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

PMD: 1 subject(s), 1 observer(s)
  - [Subject] net.sourceforge.pmd.util.viewer.model.ViewerModel
  - [Observer] net.sourceforge.pmd.util.viewer.model.ViewerModelListener