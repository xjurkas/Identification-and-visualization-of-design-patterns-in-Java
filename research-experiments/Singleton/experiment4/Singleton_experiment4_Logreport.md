Singleton — Experiment 4: Filter class utility
Date: 2026-04-29 15:36:52
Rule: static self-typed field + static no-param accessor + remove if >5 static methods

quickuml: 1 singleton(s)
  - uml.ui.IconManager

lexi: 0 singleton(s)

jrefac: 9 singleton(s)
  - org.acm.seguin.ide.common.EditorOperations
  - org.acm.seguin.ide.common.PackageListFilter
  - org.acm.seguin.ide.common.SourceBrowser
  - org.acm.seguin.ide.common.action.CurrentSummary
  - org.acm.seguin.pretty.ai.RequiredTags
  - org.acm.seguin.refactor.RefactoringFactory
  - org.acm.seguin.refactor.undo.UndoStack
  - org.acm.seguin.uml.line.LabelSizeComputation
  - org.acm.seguin.version.VersionControlCache

netbeans: 34 singleton(s)
  - org.netbeans.core.DataSystem
  - org.netbeans.core.FSPoolNode
  - org.netbeans.core.JavaHelp
  - org.netbeans.core.NbControlPanel
  - org.netbeans.core.NbPlaces
  - org.netbeans.core.Sheet
  - org.netbeans.core.actions.OptionsPanel
  - org.netbeans.core.actions.SettingsPanel
  - org.netbeans.core.output.OutputTab
  - org.netbeans.core.windows.nodes.WorkspacePoolContext
  - org.netbeans.editor.Drawer
  - org.netbeans.editor.FindSupport
  - org.netbeans.modules.editor.java.JCStorage
  - org.netbeans.modules.form.palette.ComponentPalette
  - org.netbeans.modules.form.palette.PaletteNode
  - org.netbeans.modules.i18n.LocalizeSupport
  - org.netbeans.modules.jarpackager.PackagingView
  - org.netbeans.modules.jarpackager.options.JarPackagerOption
  - org.netbeans.modules.javadoc.comments.AutoCommentTopComponent
  - org.netbeans.modules.javadoc.search.IndexSearch
  - org.netbeans.modules.jini.BrowserModel
  - org.netbeans.modules.jini.JiniNode
  - org.netbeans.modules.jndi.JndiRootNode
  - org.netbeans.modules.projects.settings.OptionsPanel
  - org.netbeans.modules.projects.settings.SettingsPanel
  - org.netbeans.modules.rmi.registry.RMIRegistryNode
  - org.netbeans.modules.rmi.registry.RMIRegistryPool
  - org.openide.TopManager
  - org.openide.actions.DebuggerPerformer
  - org.openide.actions.FolderNodeAcceptor
  - org.openide.awt.ToolbarPool
  - org.openide.explorer.propertysheet.PropertySheetSettings
  - org.openide.explorer.view.NodeRenderer
  - org.openidex.search.SearchEngine

junit: 0 singleton(s)

jhotdraw: 2 singleton(s)
  - CH.ifa.draw.util.Clipboard
  - CH.ifa.draw.util.Iconkit

mapper: 2 singleton(s)
  - com.taursys.html.HTMLComponentFactory
  - com.taursys.tools.CodeGenerator

nutch: 1 singleton(s)
  - net.nutch.plugin.PluginRepository

PMD: 0 singleton(s)