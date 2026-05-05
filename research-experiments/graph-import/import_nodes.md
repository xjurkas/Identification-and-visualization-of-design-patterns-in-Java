// Reset
MATCH (n) DETACH DELETE n;

// Create constraint
CREATE CONSTRAINT entity_id_unique IF NOT EXISTS 
FOR (e:Entity) REQUIRE e.id IS UNIQUE;

// Import nodes
// Dont forget to use raw.link in <URL> from github, because sandbox is on cloud. 
// More info in Visualization_Manual.md

CALL apoc.load.json("<URL>") YIELD value
UNWIND coalesce(value.nodes, []) AS nd
WITH nd, 
     CASE 
       WHEN nd.labels IS NOT NULL THEN nd.labels 
       WHEN nd.label IS NOT NULL THEN [nd.label] 
       ELSE [] 
     END AS lbs
MERGE (e:Entity {id: nd.id})
SET e.propsJson = apoc.convert.toJson(nd),
    e.name = coalesce(toString(nd.name), e.name),
    e.fqn = coalesce(toString(nd.fqn), e.fqn),
    e.containerFqn = coalesce(toString(nd.containerFqn), e.containerFqn),
    e.uri = coalesce(toString(nd.uri), e.uri),
    e.sig = coalesce(toString(nd.sig), e.sig),
    e.isStatic = nd.isStatic,
    e.isAbstract = nd.isAbstract,
    e.isPrivate = nd.isPrivate,
    e.isFinal = nd.isFinal,
    e.returnType = coalesce(toString(nd.returnType), e.returnType)
WITH e, lbs
CALL apoc.create.addLabels(e, [l IN lbs WHERE l IS NOT NULL | toString(l)]) 
YIELD node
RETURN count(*) AS nodesImported;