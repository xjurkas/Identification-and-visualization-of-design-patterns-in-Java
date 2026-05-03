CALL {
MATCH (compositeClass:Class)
MATCH (compositeType:Type {fqn: compositeClass.fqn})

// 1. Composite tranzitívne EXTENDS/IMPLEMENTS Component
MATCH (compositeClass)-[:EXTENDS|IMPLEMENTS*1..3]->(componentNode)
WHERE componentNode:Interface
   OR (componentNode:Class AND (
         componentNode.isAbstract = true
         OR EXISTS { MATCH (componentNode)-[:HAS_MODIFIER]->(:Modifier {name:"abstract"}) }
      ))
MATCH (componentType:Type {fqn: componentNode.fqn})
WHERE componentType <> compositeType

// 2. Child-management metóda s parametrom typu Component
MATCH (compositeType)-[:DECLARES]->(childMgmtMethod:Method)
MATCH (childMgmtMethod)-[:HAS_PARAMETER]->(param:Parameter)
MATCH (param)-[:PARAMETER_TYPE]->(componentType)
WHERE toLower(childMgmtMethod.name) STARTS WITH "add"
   OR toLower(childMgmtMethod.name) STARTS WITH "insert"
   OR toLower(childMgmtMethod.name) STARTS WITH "append"
   OR toLower(childMgmtMethod.name) STARTS WITH "addchild"
   OR toLower(childMgmtMethod.name) STARTS WITH "addelement"

WITH DISTINCT compositeType, componentType
SET compositeType:Composite
SET componentType:Component
}
