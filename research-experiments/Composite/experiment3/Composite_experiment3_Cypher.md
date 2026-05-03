CALL {
MATCH (compositeClass:Class)
MATCH (compositeType:Type {fqn: compositeClass.fqn})

MATCH (compositeClass)-[:EXTENDS|IMPLEMENTS*1..3]->(componentNode)
WHERE componentNode:Interface
   OR (componentNode:Class AND (
         componentNode.isAbstract = true
         OR EXISTS { MATCH (componentNode)-[:HAS_MODIFIER]->(:Modifier {name:"abstract"}) }
      ))
MATCH (componentType:Type {fqn: componentNode.fqn})
WHERE componentType <> compositeType

MATCH (compositeType)-[:DECLARES]->(childMgmtMethod:Method)
MATCH (childMgmtMethod)-[:HAS_PARAMETER]->(param:Parameter)
MATCH (param)-[:PARAMETER_TYPE]->(componentType)
WHERE toLower(childMgmtMethod.name) STARTS WITH "add"
   OR toLower(childMgmtMethod.name) STARTS WITH "insert"
   OR toLower(childMgmtMethod.name) STARTS WITH "append"
   OR toLower(childMgmtMethod.name) STARTS WITH "addchild"
   OR toLower(childMgmtMethod.name) STARTS WITH "addelement"

// 3. NOVÉ: Composite má field typu kolekcie ALEBO field typu Component
WITH DISTINCT compositeType, componentType
WHERE EXISTS {
    MATCH (compositeType)-[:HAS_FIELD]->(f:Field)-[:FIELD_TYPE]->(ft:Type)
    WHERE ft = componentType
       OR ft.name IN ["Vector","List","ArrayList","LinkedList","Collection","Set","HashSet","TreeSet","Hashtable","HashMap","Map"]
       OR ft.fqn ENDS WITH ".Vector"
       OR ft.fqn ENDS WITH ".List"
       OR ft.fqn ENDS WITH ".ArrayList"
       OR ft.fqn ENDS WITH ".LinkedList"
       OR ft.fqn ENDS WITH ".Collection"
       OR ft.fqn ENDS WITH ".Set"
       OR ft.fqn ENDS WITH ".HashSet"
       OR ft.fqn ENDS WITH ".Hashtable"
}

SET compositeType:Composite
SET componentType:Component
}
