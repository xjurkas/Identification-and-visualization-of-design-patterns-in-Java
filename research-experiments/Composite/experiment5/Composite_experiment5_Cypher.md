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

// 5. NOVÉ: Composite metóda CALLS metódu deklarovanú na Component
//    (delegácia na deti — typický forwarding)
WITH DISTINCT compositeType, componentType
WHERE EXISTS {
    MATCH (compositeType)-[:DECLARES]->(cm:Method)-[:CALLS]->(target:Method)
    MATCH (componentType)-[:DECLARES]->(target)
}

SET compositeType:Composite
SET componentType:Component
}
