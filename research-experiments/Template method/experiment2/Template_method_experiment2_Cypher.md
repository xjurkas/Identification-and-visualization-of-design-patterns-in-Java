CALL {
MATCH (abstractNode:Class)
WHERE (abstractNode.isAbstract = true
       OR EXISTS { MATCH (abstractNode)-[:HAS_MODIFIER]->(:Modifier {name:"abstract"}) })
  AND EXISTS { MATCH (abstractNode)-[:IN_FILE]->() }

MATCH (abstractType:Type {fqn: abstractNode.fqn})

WITH abstractNode, abstractType

// Existuje konkrétna metóda (template method kandidát) ktorá CALLS abstraktnú
// metódu tej istej triedy (primitive operation)
WHERE EXISTS {
    MATCH (abstractType)-[:DECLARES]->(tm:Method)
    WHERE tm.isAbstract = false
       OR (NOT EXISTS { MATCH (tm)-[:HAS_MODIFIER]->(:Modifier {name:"abstract"}) }
           AND tm.isAbstract IS NULL)
    MATCH (tm)-[:CALLS]->(po:Method)
    MATCH (abstractType)-[:DECLARES]->(po)
    WHERE po.isAbstract = true
       OR EXISTS { MATCH (po)-[:HAS_MODIFIER]->(:Modifier {name:"abstract"}) }
}

// Existuje aspoň jedna podtrieda
AND EXISTS {
    MATCH (concreteClass:Class)-[:EXTENDS*1..3]->(abstractNode)
    WHERE concreteClass.fqn <> abstractNode.fqn
}

WITH abstractNode, abstractType

MATCH (abstractType)-[:DECLARES]->(tm:Method)
WHERE tm.isAbstract = false
   OR (
        NOT EXISTS {
          MATCH (tm)-[:HAS_MODIFIER]->(:Modifier {name:"abstract"})
        }
        AND tm.isAbstract IS NULL
      )

MATCH (tm)-[:CALLS]->(po:Method)
MATCH (abstractType)-[:DECLARES]->(po)
WHERE po.isAbstract = true
   OR EXISTS {
        MATCH (po)-[:HAS_MODIFIER]->(:Modifier {name:"abstract"})
      }

MATCH (concreteClass:Class)-[:EXTENDS*1..3]->(abstractNode)
WHERE concreteClass.fqn <> abstractNode.fqn

WITH
  abstractType,
  collect(DISTINCT tm.name) AS templateMethodNames,
  collect(DISTINCT po.name) AS primitiveOperationNames,
  collect(DISTINCT concreteClass.fqn) AS concreteClassFqns

SET abstractType:AbstractClass

RETURN DISTINCT
  abstractType,
  templateMethodNames,
  primitiveOperationNames,
  concreteClassFqns
}

RETURN DISTINCT
  abstractType.fqn AS abstractClassFqn,
  templateMethodNames,
  primitiveOperationNames,
  concreteClassFqns
ORDER BY abstractClassFqn;
