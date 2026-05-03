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

// 4. NOVÉ: musí existovať Leaf — iná trieda tranzitívne implementujúca Component
//    bez child-management metódy s parametrom typu Component
WITH DISTINCT compositeClass, compositeType, componentNode, componentType
WHERE EXISTS {
    MATCH (leafClass:Class)-[:EXTENDS|IMPLEMENTS*1..3]->(componentNode)
    MATCH (leafType:Type {fqn: leafClass.fqn})
    WHERE leafClass <> compositeClass
      AND NOT EXISTS {
          MATCH (leafType)-[:DECLARES]->(m:Method)-[:HAS_PARAMETER]->(p:Parameter)-[:PARAMETER_TYPE]->(componentType)
          WHERE toLower(m.name) STARTS WITH "add"
             OR toLower(m.name) STARTS WITH "insert"
             OR toLower(m.name) STARTS WITH "append"
             OR toLower(m.name) STARTS WITH "addchild"
             OR toLower(m.name) STARTS WITH "addelement"
      }
}

SET compositeType:Composite
SET componentType:Component

WITH compositeType, componentType, componentNode, compositeClass
MATCH (leafClass:Class)-[:EXTENDS|IMPLEMENTS*1..3]->(componentNode)
MATCH (leafType:Type {fqn: leafClass.fqn})
WHERE leafClass <> compositeClass
  AND NOT EXISTS {
      MATCH (leafType)-[:DECLARES]->(m:Method)-[:HAS_PARAMETER]->(p:Parameter)-[:PARAMETER_TYPE]->(componentType)
      WHERE toLower(m.name) STARTS WITH "add"
         OR toLower(m.name) STARTS WITH "insert"
         OR toLower(m.name) STARTS WITH "append"
         OR toLower(m.name) STARTS WITH "addchild"
         OR toLower(m.name) STARTS WITH "addelement"
  }
SET leafType:Leaf
}
