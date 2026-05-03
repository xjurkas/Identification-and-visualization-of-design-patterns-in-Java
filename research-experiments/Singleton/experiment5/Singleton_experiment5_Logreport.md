Singleton — Pokus 5: Kombinovaná disjunkcia
Datum: 2026-04-29 15:38:30
Pravidlo: static self-typed field + static no-param accessor + (PRIVATE CONSTRUCTOR alebo SINGLETON NAMING)

quickuml: 1 singleton(s)
  - uml.ui.IconManager

lexi: 2 singleton(s)
  - com.jmonkey.export.Registry
  - com.jmonkey.office.lexi.support.EditorActionManager

jrefac: 2 singleton(s)
  - org.acm.seguin.pretty.ai.RequiredTags
  - org.acm.seguin.uml.line.LabelSizeComputation

netbeans: 33 singleton(s)
  - org.netbeans.core.DataSystem
  - org.netbeans.core.FSPoolNode
  - org.netbeans.core.JavaHelp
  - org.netbeans.core.LoaderPoolNode
  - org.netbeans.core.NbControlPanel
  - org.netbeans.core.NbPlaces
  - org.netbeans.core.Sheet
  - org.netbeans.core.actions.OptionsPanel
  - org.netbeans.core.actions.SettingsPanel
  - org.netbeans.core.execution.ExecutionEngine
  - org.netbeans.core.windows.WindowManagerImpl
  - org.netbeans.core.windows.nodes.WorkspacePoolContext
  - org.netbeans.editor.Drawer
  - org.netbeans.editor.FindSupport
  - org.netbeans.editor.Registry
  - org.netbeans.modules.form.palette.ComponentPalette
  - org.netbeans.modules.form.palette.PaletteNode
  - org.netbeans.modules.i18n.LocalizeSupport
  - org.netbeans.modules.jarpackager.PackagingView
  - org.netbeans.modules.jarpackager.options.JarPackagerOption
  - org.netbeans.modules.javadoc.comments.AutoCommentTopComponent
  - org.netbeans.modules.javadoc.search.IndexSearch
  - org.netbeans.modules.jini.BrowserModel
  - org.netbeans.modules.jndi.JndiRootNode
  - org.netbeans.modules.projects.settings.OptionsPanel
  - org.netbeans.modules.projects.settings.SettingsPanel
  - org.netbeans.modules.rmi.registry.RMIRegistryPool
  - org.openide.TopManager
  - org.openide.actions.DebuggerPerformer
  - org.openide.actions.FolderNodeAcceptor
  - org.openide.awt.ToolbarPool
  - org.openide.explorer.propertysheet.PropertySheetSettings
  - org.openidex.search.SearchEngine

junit: 0 singleton(s)

jhotdraw: 2 singleton(s)
  - CH.ifa.draw.util.Clipboard
  - CH.ifa.draw.util.Iconkit

mapper: 3 singleton(s)
  - com.taursys.debug.Debug
  - com.taursys.html.HTMLComponentFactory
  - com.taursys.tools.CodeGenerator

nutch: 1 singleton(s)
  - net.nutch.plugin.PluginRepository

PMD: 0 singleton(s)

============================================================
SÚHRN
============================================================
Projekt          Počet
-------------------------
quickuml             1
lexi                 2
jrefac               2
netbeans            33
junit                0
jhotdraw             2
mapper               3
nutch                1
PMD                  0
-------------------------
SPOLU               44

VŠETKY NÁJDENÉ TRIEDY:
  quickuml:
    uml.ui.IconManager
  lexi:
    com.jmonkey.export.Registry
    com.jmonkey.office.lexi.support.EditorActionManager
  jrefac:
    org.acm.seguin.pretty.ai.RequiredTags
    org.acm.seguin.uml.line.LabelSizeComputation
  netbeans:
    org.netbeans.core.DataSystem
    org.netbeans.core.FSPoolNode
    org.netbeans.core.JavaHelp
    org.netbeans.core.LoaderPoolNode
    org.netbeans.core.NbControlPanel
    org.netbeans.core.NbPlaces
    org.netbeans.core.Sheet
    org.netbeans.core.actions.OptionsPanel
    org.netbeans.core.actions.SettingsPanel
    org.netbeans.core.execution.ExecutionEngine
    org.netbeans.core.windows.WindowManagerImpl
    org.netbeans.core.windows.nodes.WorkspacePoolContext
    org.netbeans.editor.Drawer
    org.netbeans.editor.FindSupport
    org.netbeans.editor.Registry
    org.netbeans.modules.form.palette.ComponentPalette
    org.netbeans.modules.form.palette.PaletteNode
    org.netbeans.modules.i18n.LocalizeSupport
    org.netbeans.modules.jarpackager.PackagingView
    org.netbeans.modules.jarpackager.options.JarPackagerOption
    org.netbeans.modules.javadoc.comments.AutoCommentTopComponent
    org.netbeans.modules.javadoc.search.IndexSearch
    org.netbeans.modules.jini.BrowserModel
    org.netbeans.modules.jndi.JndiRootNode
    org.netbeans.modules.projects.settings.OptionsPanel
    org.netbeans.modules.projects.settings.SettingsPanel
    org.netbeans.modules.rmi.registry.RMIRegistryPool
    org.openide.TopManager
    org.openide.actions.DebuggerPerformer
    org.openide.actions.FolderNodeAcceptor
    org.openide.awt.ToolbarPool
    org.openide.explorer.propertysheet.PropertySheetSettings
    org.openidex.search.SearchEngine
  jhotdraw:
    CH.ifa.draw.util.Clipboard
    CH.ifa.draw.util.Iconkit
  mapper:
    com.taursys.debug.Debug
    com.taursys.html.HTMLComponentFactory
    com.taursys.tools.CodeGenerator
  nutch:
    net.nutch.plugin.PluginRepository