CALL {
MATCH (abstractNode:Class)
WHERE (abstractNode.isAbstract = true
       OR EXISTS { MATCH (abstractNode)-[:HAS_MODIFIER]->(:Modifier {name:"abstract"}) })
  AND EXISTS { MATCH (abstractNode)-[:IN_FILE]->() }

MATCH (abstractType:Type {fqn: abstractNode.fqn})

WITH abstractNode, abstractType

// Template method CALLS primitive operation (P2)
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

// NOVÉ: Anti-Factory Method diskriminátor
// Aspoň jedna abstract metóda, ktorá je volaná z template method, NESMIE
// vracať objektový typ z projektu (to by bolo Factory Method).
// Alebo: existuje abstract metóda ktorá vracia void/primitívny typ
AND EXISTS {
    MATCH (abstractType)-[:DECLARES]->(po2:Method)
    WHERE (po2.isAbstract = true
           OR EXISTS { MATCH (po2)-[:HAS_MODIFIER]->(:Modifier {name:"abstract"}) })
      AND EXISTS {
          MATCH (tm2:Method)-[:CALLS]->(po2)
          MATCH (abstractType)-[:DECLARES]->(tm2)
          WHERE tm2.isAbstract = false
             OR (NOT EXISTS { MATCH (tm2)-[:HAS_MODIFIER]->(:Modifier {name:"abstract"}) }
                 AND tm2.isAbstract IS NULL)
      }
      AND (
          // A) Nemá RETURN_TYPE hranu (void alebo primitívny typ)
          NOT EXISTS { MATCH (po2)-[:RETURN_TYPE]->() }
          OR
          // B) Return type je primitívny alebo nie je v projekte
          EXISTS {
              MATCH (po2)-[:RETURN_TYPE]->(rt:Type)
              WHERE NOT EXISTS { MATCH (rt)-[:IN_FILE]->() }
                 OR rt.name IN ["void","boolean","int","long","short","byte","float","double","char","String"]
          }
      )
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
