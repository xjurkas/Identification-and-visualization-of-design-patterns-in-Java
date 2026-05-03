Singleton — Pokus 3: Pomenovanie accessoru
Datum: 2026-04-29 15:35:18
Pravidlo: static self-typed field + static no-param accessor s názvom getInstance/getDefault/get+ClassName

quickuml: 1 singleton(s)
  - uml.ui.IconManager

lexi: 0 singleton(s)

jrefac: 0 singleton(s)

netbeans: 18 singleton(s)
  - org.netbeans.core.JavaHelp
  - org.netbeans.core.NbControlPanel
  - org.netbeans.core.NbPlaces
  - org.netbeans.core.Sheet
  - org.netbeans.core.windows.WindowManagerImpl
  - org.netbeans.core.windows.nodes.WorkspacePoolContext
  - org.netbeans.modules.form.palette.ComponentPalette
  - org.netbeans.modules.javadoc.comments.AutoCommentTopComponent
  - org.netbeans.modules.javadoc.search.IndexSearch
  - org.netbeans.modules.jini.BrowserModel
  - org.netbeans.modules.jndi.JndiRootNode
  - org.netbeans.modules.rmi.registry.RMIRegistryPool
  - org.openide.TopManager
  - org.openide.actions.DebuggerPerformer
  - org.openide.actions.FolderNodeAcceptor
  - org.openide.awt.ToolbarPool
  - org.openide.explorer.propertysheet.PropertySheetSettings
  - org.openidex.search.SearchEngine

junit: 0 singleton(s)

jhotdraw: 0 singleton(s)

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
lexi                 0
jrefac               0
netbeans            18
junit                0
jhotdraw             0
mapper               3
nutch                1
PMD                  0
-------------------------
SPOLU               23

VŠETKY NÁJDENÉ TRIEDY:
  quickuml:
    uml.ui.IconManager
  netbeans:
    org.netbeans.core.JavaHelp
    org.netbeans.core.NbControlPanel
    org.netbeans.core.NbPlaces
    org.netbeans.core.Sheet
    org.netbeans.core.windows.WindowManagerImpl
    org.netbeans.core.windows.nodes.WorkspacePoolContext
    org.netbeans.modules.form.palette.ComponentPalette
    org.netbeans.modules.javadoc.comments.AutoCommentTopComponent
    org.netbeans.modules.javadoc.search.IndexSearch
    org.netbeans.modules.jini.BrowserModel
    org.netbeans.modules.jndi.JndiRootNode
    org.netbeans.modules.rmi.registry.RMIRegistryPool
    org.openide.TopManager
    org.openide.actions.DebuggerPerformer
    org.openide.actions.FolderNodeAcceptor
    org.openide.awt.ToolbarPool
    org.openide.explorer.propertysheet.PropertySheetSettings
    org.openidex.search.SearchEngine
  mapper:
    com.taursys.debug.Debug
    com.taursys.html.HTMLComponentFactory
    com.taursys.tools.CodeGenerator
  nutch:
    net.nutch.plugin.PluginRepository