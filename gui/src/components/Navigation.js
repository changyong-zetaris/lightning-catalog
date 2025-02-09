import React, { useState, useEffect, useRef, useMemo } from 'react';
import { SimpleTreeView, TreeItem } from '@mui/x-tree-view';
import { fetchApi } from '../utils/common';
import './Navigation.css';
import '../styleguides/styleguides.css';
import { setPathKeywords } from '../components/configs/editorConfig';
import { ReactComponent as CirclePlus } from '../assets/images/circle-plus-solid.svg';
import { ReactComponent as TableIcon } from '../assets/images/table-solid.svg';
import { ReactComponent as FolderIcon } from '../assets/images/folder-regular.svg';
import { ReactComponent as PreviewIcon } from '../assets/images/circle-play-regular.svg';
import { ReactComponent as MinusIcon } from '../assets/images/square-minus-regular-black.svg';
import { ReactComponent as PlusIcon } from '../assets/images/square-plus-regular-black.svg';
import { ReactComponent as PkIcon } from '../assets/images/key-outline.svg';
import { ReactComponent as UniqueIcon } from '../assets/images/fingerprint-solid.svg';
import { ReactComponent as IndexIcon } from '../assets/images/book-solid.svg';
import { ReactComponent as NNIcon } from '../assets/images/notnull-icon.svg';
import { ReactComponent as LinkIcon } from '../assets/images/link-solid.svg';
import SetSemanticLayerModal from './SetSemanticLayerModal';
import Resizable from 'react-resizable-layout';
import { v4 as uuidv4 } from 'uuid';

const Navigation = ({ refreshNav, onGenerateDDL, setView, setUslNamebyClick, setPreviewTableName, setIsLoading, setIsMouseLoading, setNavErrorMsg, previewableTables, setPreviewableTables }) => {

  const reSizingOffset = 115;
  const resizingRef = useRef(false);
  const [showPopup, setShowPopup] = useState(false);
  const [ddlName, setDdlName] = useState('');
  const [ddlCode, setDdlCode] = useState('');
  const [expandedNodeIds, setExpandedNodeIds] = useState(() => {
    const storedExpanded = localStorage.getItem('expandedNodeIds');
    return storedExpanded ? JSON.parse(storedExpanded) : [];
  });
  const [activeInputNode, setActiveInputNode] = useState(null);
  const [inputValue, setInputValue] = useState('');
  const [hasTableChild, setHasTableChild] = useState(null);
  const [selectedUSL, setSelectedUSL] = useState('');
  const [currentFullPaths, setCurrentFullPaths] = useState([]);
  const [popupMessage, setPopupMessage] = useState(null);
  const [loadingNodeIds, setLoadingNodeIds] = useState(new Set());
  const [selectedTreeItem, setSelectedTreeItem] = useState(null);
  const [showConfirmPopup, setShowConfirmPopup] = useState(false);
  const [uslToRemove, setUslToRemove] = useState(null);
  const [isERDClicked, setIsERDClicked] = useState(false);

  const closePopup = () => setPopupMessage(null);

  const startLoading = (nodeId) => {
    setLoadingNodeIds((prev) => new Set(prev).add(nodeId));
    setIsMouseLoading(true);
  };

  const stopLoading = (nodeId) => {
    setIsMouseLoading(false);
    setLoadingNodeIds((prev) => {
      const newSet = new Set(prev);
      newSet.delete(nodeId);
      return newSet;
    });
  };


  // State for managing datasource tree structure
  const [dataSources, setDataSources] = useState([
    {
      name: 'lightning.datasource',
      children: null
    }
  ]);

  // State for managing semantic layer files
  const [semanticLayerFiles, setSemanticLayerFiles] = useState([
    {
      name: 'lightning.metastore',
      children: null
    }
  ]);

  // const handleGenerateClick = () => {
  //   if (!ddlName.trim()) {
  //     // setPopupMessage('Semantic Layer Name cannot be empty. Please enter a valid name.');
  //     setPopupMessage('Semantic Layer Name cannot be empty. Please enter a valid name.');
  //     return;
  //   }

  //   const isValidNamespace = /^[a-zA-Z0-9_]+$/.test(ddlName);
  //   if (!isValidNamespace) {
  //     setPopupMessage(`DDL name can only contain letters, numbers, and underscores.`);
  //     return;
  //   }

  //   let selectedUSLPath;
  //   if (selectedTreeItem) {
  //     selectedUSLPath = selectedTreeItem.fullPath;

  //     if (!selectedUSLPath.startsWith('lightning.metastore')) {
  //       selectedUSLPath = null;
  //     }
  //   }

  //   onGenerateDDL(ddlName, ddlCode, selectedUSLPath);
  //   setShowPopup(false);
  //   setView('semanticLayer');
  // };

  const handleGenerateClick = async () => {
    if (!ddlName.trim()) {
      setPopupMessage('Semantic Layer Name cannot be empty. Please enter a valid name.');
      return;
    }

    const isValidNamespace = /^[a-zA-Z0-9_]+$/.test(ddlName);
    if (!isValidNamespace) {
      setPopupMessage(`DDL name can only contain letters, numbers, and underscores.`);
      return;
    }

    if (ddlCode === '') {
      setPopupMessage(`DDL Code cannot be empty. Please enter a valid Code.`);
      return;
    }

    let selectedUSLPath;
    if (selectedTreeItem) {
      selectedUSLPath = selectedTreeItem.fullPath;
    } else {
      setNavErrorMsg(`Please select the correct namespace.`);
    }

    const checkDuplicateName = (nodes, parentPath) => {
      for (const node of nodes) {
        if (node.fullPath === parentPath) {
          // Check if any child has the same name as ddlName
          return (node.children || []).some((child) => child.name === ddlName);
        }
        if (node.children) {
          if (checkDuplicateName(node.children, parentPath)) {
            return true;
          }
        }
      }
      return false;
    };

    const isDuplicate = checkDuplicateName(semanticLayerFiles, selectedUSLPath);
    if (isDuplicate) {
      setPopupMessage(`A child with the name '${ddlName}' already exists in the selected namespace.`);
      return;
    }

    onGenerateDDL(ddlName, ddlCode, selectedUSLPath);

    const basePath = selectedUSLPath || 'lightning.metastore';
    const newPath = `${basePath}.${ddlName}`;

    const newNode = {
      name: ddlName,
      fullPath: newPath,
      type: 'usl',
      children: null,
      uniqueId: `${newPath}`,
    };

    setSemanticLayerFiles((prevData) => {
      const updateNestedNode = (nodes, parentPath) => {
        // console.log(nodes)
        return nodes.map(node => {
          if (node.fullPath === parentPath) {
            return {
              ...node,
              children: [...(node.children || []), newNode]
            };
          }

          if (node.children) {
            return {
              ...node,
              children: updateNestedNode(node.children, parentPath)
            };
          }
          return node;
        });
      };

      return updateNestedNode(prevData, basePath);
    });

    setShowPopup(false);
    setView('semanticLayer');
  };

  const handleMouseMove = (e) => {
    if (resizingRef.current) {
      e.preventDefault();
    }
  };

  const handleMouseUp = () => {
    resizingRef.current = false;
  };

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  useEffect(() => {
    const fetchInitialData = async () => {
      // Fetch DataSource tree
      const dataSourceChildren = await fetchDatasources('lightning.datasource');
      if (dataSourceChildren) {
        const updatedDataSources = dataSources.map((node) => ({
          ...node,
          children: dataSourceChildren,
        }));
        setDataSources(updatedDataSources);
      }

      // Fetch SemanticLayer tree
      const semanticLayerChildren = await fetchDatasources('lightning.metastore');
      if (semanticLayerChildren) {
        const updatedSemanticLayers = semanticLayerFiles.map((node) => ({
          ...node,
          children: semanticLayerChildren,
        }));
        setSemanticLayerFiles(updatedSemanticLayers);
      }
    };
    fetchInitialData();
  }, []);

  useEffect(() => {
    const expandNodes = async () => {
      try {
        for (const nodeId of expandedNodeIds) {
          try {
            const node = findNodeById(dataSources, nodeId) || findNodeById(semanticLayerFiles, nodeId);
            if (node && !node.children) {
              await handleTreeItemClick(node, false);
            }
          } catch (nodeError) {
            console.error(`Error processing node ${nodeId}:`, nodeError);
            continue;
          }
        }
      } catch (error) {
        console.error('Error expanding nodes:', error);
        // setNavErrorMsg('Error loading tree structure. Some items may not be visible.');
      }
    };
  
    expandNodes();
  }, [dataSources, semanticLayerFiles, expandedNodeIds]);

  const findNodeById = (nodes, id) => {
    for (const node of nodes) {
      if (node.uniqueId === id) return node;
      if (node.children) {
        const found = findNodeById(node.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  useEffect(() => {
    localStorage.setItem('expandedNodeIds', JSON.stringify(expandedNodeIds));
  }, [expandedNodeIds]);

  useEffect(() => {
    if (currentFullPaths.length > 0) {
      // setPathKeywords(currentFullPaths);
    }
  }, [currentFullPaths]);

  useEffect(() => {
    const loadUSLFromStorage = () => {
      const storedUSL = localStorage.getItem(selectedUSL);
      if (storedUSL) {
        const uslData = JSON.parse(storedUSL);
        const semanticLayerTree = renderTreeFromUSL(uslData);
        // setSemanticLayerFiles((prevData) => updateNodeChildren(prevData, uslData.name, semanticLayerTree));
        setSemanticLayerFiles((prevData) => updateNodeChildren(prevData, uslData.fullPath || uslData.name, semanticLayerTree));
      }
    };

    loadUSLFromStorage();
  }, []);

  // Function to get the depth (level) of the current path
  const getCurrentLevel = (fullPath) => {
    const parts = fullPath.split('.');
    return parts.length;
  };

  const fetchedPaths = new Set();

  // const fetchDatasources = async (fullPath) => {
  //   if (fetchedPaths.has(fullPath)) {
  //     // console.log(`Already fetched: ${fullPath}`);
  //     return [];
  //   }
  //   fetchedPaths.add(fullPath);

  //   let query;
  //   if (fullPath.toLowerCase().includes('datasource') || fullPath.toLowerCase().includes('metastore')) {
  //     query = `SHOW NAMESPACES OR TABLES IN ${fullPath};`;
  //   }

  //   const result = await fetchApi(query);
  //   if (!Array.isArray(result) || result.length === 0) {
  //     return [];
  //   }

  //   const fetchedData = result.map((item) => JSON.parse(item)).map((parsedItem) => ({
  //     name: parsedItem.name,
  //     fullPath: `${fullPath}.${parsedItem.name}`,
  //     type: parsedItem.type,
  //     children: null,
  //   }));

  //   return fetchedData;
  // };

  const removeDuplicates = (items, keyGenerator) => {
    const seen = new Set();
    return items.filter((item) => {
      const key = keyGenerator(item);
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  };

  const fetchDatasources = async (fullPath) => {
    if (fullPath.startsWith('metastore')) {
      fullPath = 'lightning.' + fullPath;
    }

    if (fetchedPaths.has(fullPath)) {
      return [];
    }
    fetchedPaths.add(fullPath);

    let query;
    if (fullPath.toLowerCase().includes('datasource') || fullPath.toLowerCase().includes('metastore')) {
      query = `SHOW NAMESPACES OR TABLES IN ${fullPath};`;
    }

    const result = await fetchApi(query);
    if (!Array.isArray(result) || result.length === 0) {
      return [];
    }

    // Remove duplicates based on 'name' and 'type'
    const uniqueData = removeDuplicates(
      result.map((item) => {
        const parsedItem = JSON.parse(item);
        return {
          name: parsedItem.name,
          fullPath: `${fullPath}.${parsedItem.name}`,
          type: parsedItem.type,
          children: null,
          uniqueId: `${fullPath}.${parsedItem.name}`
        };
      }),
      (item) => `${item.name}-${item.type}`
    );

    return uniqueData;
  };

  const getTableDesc = async (fullPath) => {
    let query = `DESC ${fullPath}`;
    const result = await fetchApi(query);
    if (result) {
      const parsedResult = result.map((item) => JSON.parse(item));
      return parsedResult;
    } else {
      return [];
    }
  };

  const renderTreeFromUSL = (uslData) => {
    const { namespace, name, tables, subUsl = [] } = uslData;

    // Process tables
    const tableItems = tables.map((table) => ({
      name: table.name,
      fullPath: `${namespace.join('.')}.${name}.${table.name}`,
      type: 'table',
      children: null, // Table columns are loaded dynamically
      // uniqueId: `${namespace.join('.')}.${name}.${table.name}`
    }));

    // Process sub-USLs (store only name and namespace)
    const subUslItems = subUsl.map((subUslItem) => ({
      name: subUslItem.name,
      fullPath: subUslItem.namespace,
      type: 'usl',
      children: null, // Sub-USL details are loaded dynamically
      // uniqueId: subUslItem.namespace
    }));

    return [...tableItems, ...subUslItems];
  };

  const handleTreeItemClick = async (node, isSetSelectedTree = true) => {

    if (isSetSelectedTree) {
      setSelectedTreeItem({
        name: node.name,
        fullPath: node.fullPath,
        type: node.type,
        uniqueId: node.uniqueId,
      });
    }

    if (node.type === 'column') {
      return;
    }

    if (loadingNodeIds.has(node.uniqueId)) {
      return;
    }

    // if (node.children && node.children.length > 0) {
    //   return;
    // }

    startLoading(node.uniqueId);

    try {
      if (node.type === 'table') {

        if (node.fullPath.toLowerCase().includes('datasource')) {
          setPreviewableTables((prev) => new Set(prev).add(node.fullPath));
        }

        let uslName;
        let storedData;

        if (node.fullPath.toLowerCase().includes('metastore')) {
          // uslName = node.fullPath.match(/usldb\.([^.]+)/)[1];
          // uslName = node.fullPath.match(/default(?:\.[^.]+)*\.([^.]+)\.[^.]+$/)?.[1];
          // uslName = node.fullPath.split('.').slice(-2, -1)[0];
          uslName = node.fullPath.split('.').slice(0, -1).join('.');
        }

        if (uslName) {
          storedData = JSON.parse(localStorage.getItem(uslName));
        }

        let storedDataFullPath;

        if (storedData) {
          storedDataFullPath = `lightning.${storedData.namespace.join('.')}.${storedData.name}`;
        }

        if (storedDataFullPath === uslName && uslName && node.type === 'table') {
          const selectedTable = storedData.tables.find(table => table.name === node.name);

          if (selectedTable) {
            const columnChildren = selectedTable.columnSpecs.map((column) => {
              const icons = [];
              if (column.primaryKey) {
                icons.push(
                  <PkIcon key={`pk-${column.name}`} style={{ width: '16px', height: '16px', marginLeft: '4px' }} />
                );
              }
              if (column.foreignKey) {
                icons.push(
                  <LinkIcon key={`fk-${column.name}`} style={{ width: '16px', height: '16px', marginLeft: '4px' }} />
                );
              }
              if (column.notNull) {
                icons.push(
                  <NNIcon key={`nn-${column.name}`} style={{ width: '16px', height: '16px', marginLeft: '4px' }} />
                );
              }

              return {
                name: (
                  <span style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{ marginRight: '8px', fill: '#888', display: 'flex', alignItems: 'center' }}>{icons}</span>
                    <span>{column.name}</span>
                  </span>
                ),
                fullPath: `${storedData.namespace.join('.')}.${storedData.name}.${selectedTable.name}.${column.name}`,
                type: 'column',
                uniqueId: `${storedData.namespace.join('.')}.${storedData.name}.${selectedTable.name}.${column.name}`,
                dataTypeElement: (
                  <span style={{ fontSize: '0.8em', color: '#888', marginLeft: '10px' }}>
                    ({column.dataType.replace(/"/g, '')})
                  </span>
                ),
              };
            });

            setSemanticLayerFiles((prevData) =>
              updateNodeChildren(prevData, node.fullPath, columnChildren)
            );
          }
          return;
        }

        if (node.fullPath.toLowerCase().includes('metastore') && hasTableChild && storedData) {
          // console.log('Skipping getTableDesc');
          return;
        }

        const tableDetails = await getTableDesc(node.fullPath);

        // const columnFullPath = tableDetails.map((column) => `${node.fullPath}.${column.col_name}`);
        // setCurrentFullPaths((prevPaths) => [...prevPaths, ...columnFullPath]);

        const tableChildren = tableDetails.map((column) => ({
          name: column.col_name,
          fullPath: `${node.fullPath}.${column.col_name}`,
          type: 'column',
          children: null,
          dataTypeElement: (
            <span style={{ fontSize: '0.8em', color: '#888', marginLeft: '10px' }}>
              ({column.data_type})
            </span>
          ),
        }));

        node.children = tableChildren;

        if (node.fullPath.toLowerCase().includes('metastore')) {
          // setSemanticLayerFiles((prevData) => updateNodeChildren(prevData, node.name, tableChildren));
          setSemanticLayerFiles((prevData) => updateNodeChildren(prevData, node.fullPath || node.name, tableChildren));
        } else {
          setDataSources((prevData) => updateNodeChildren(prevData, node.name, tableChildren));
        }
      } else {
        // const hasTableChildResult = Array.isArray(node.children)
        //   ? node.children.some((child) => child.type === 'table')
        //   : false;
        // setHasTableChild(hasTableChildResult);

        const storedData = localStorage.getItem(node.name);

        // if (hasTableChild && node.fullPath.toLowerCase().includes('metastore')) {
        if (storedData && node.fullPath.toLowerCase().includes('metastore')) {

          if (storedData) {
            const uslData = JSON.parse(storedData);

            // Process tables
            const semanticLayerChildren = uslData.tables.map((table) => ({
              name: table.name,
              fullPath: `${uslData.namespace.join('.')}.${uslData.name}.${table.name}`,
              type: 'table',
              activateQuery: table.activateQuery,
              children: table.columnSpecs.map((column) => {
                const icons = [];
                if (column.primaryKey) {
                  icons.push(
                    <PkIcon key={`pk-${column.name}`} style={{ width: '16px', height: '16px', marginLeft: '4px' }} />
                  );
                }
                if (column.foreignKey) {
                  icons.push(
                    <LinkIcon key={`fk-${column.name}`} style={{ width: '16px', height: '16px', marginLeft: '4px' }} />
                  );
                }
                if (column.notNull) {
                  icons.push(
                    <NNIcon key={`nn-${column.name}`} style={{ width: '16px', height: '16px', marginLeft: '4px' }} />
                  );
                }

                return {
                  name: (
                    <span style={{ display: 'flex', alignItems: 'center' }}>
                      <span style={{ marginRight: '8px', fill: '#888', display: 'flex', alignItems: 'center' }}>
                        {icons}
                      </span>
                      <span>{column.name}</span>
                    </span>
                  ),
                  fullPath: `${uslData.namespace.join('.')}.${uslData.name}.${table.name}.${column.name}`,
                  type: 'column',
                  dataTypeElement: (
                    <span style={{ fontSize: '0.8em', color: '#888', marginLeft: '10px' }}>
                      ({column.dataType.replace(/"/g, '')})
                    </span>
                  ),
                };
              }),
            }));

            // Process sub-USLs
            const subUslChildren = uslData.subUsl?.map((subUsl) => ({
              name: subUsl.name,
              fullPath: `${uslData.namespace.join('.')}.${uslData.name}.${subUsl.name}`,
              type: 'usl',
              children: null,
            })) || [];

            // Combine tables and sub-USLs
            const combinedChildren = [...semanticLayerChildren, ...subUslChildren];

            // Update tree with combined children
            // setSemanticLayerFiles((prevData) => updateNodeChildren(prevData, node.name, combinedChildren));
            setSemanticLayerFiles((prevData) =>
              updateNodeChildren(prevData, node.fullPath || node.name, combinedChildren)
            );

            // Set previewable tables
            uslData.tables.forEach((table) => {
              if (table.activateQuery) {
                setPreviewableTables((prev) => {
                  const newSet = new Set(prev);
                  newSet.add(`${uslData.namespace.join('.')}.${uslData.name}.${table.name}`);
                  return newSet;
                });
              }
            });

            // Add sub-USLs to previewable tables if needed
            uslData.subUsl?.forEach((subUsl) => {
              setPreviewableTables((prev) => {
                const newSet = new Set(prev);
                newSet.add(`${uslData.namespace.join('.')}.${uslData.name}.${subUsl.name}`);
                return newSet;
              });
            });
          } else {
            const dbname = node.fullPath.split('.').pop();
            const path = node.fullPath.split('.').slice(0, -1).join('.');

            try {
              const query = `LOAD USL ${dbname} NAMESPACE ${path}`;
              const result = await fetchApi(query);
              const uslData = JSON.parse(JSON.parse(result).json);

              localStorage.setItem(node.fullPath, JSON.stringify(uslData));

              const semanticLayerChildren = uslData.tables.map((table) => ({
                name: table.name,
                fullPath: `${uslData.namespace.join('.')}.${uslData.name}.${table.name}`,
                type: 'table',
                children: table.columnSpecs.map((column) => ({
                  name: column.name,
                  fullPath: `${uslData.namespace.join('.')}.${uslData.name}.${table.name}.${column.name}`,
                  type: 'column',
                  dataTypeElement: (
                    <span style={{ fontSize: '0.8em', color: '#888', marginLeft: '10px' }}>
                      ({column.dataType.replace(/"/g, '')})
                    </span>
                  ),
                })),
              }));

              // setSemanticLayerFiles((prevData) => updateNodeChildren(prevData, node.name, semanticLayerChildren));
              setSemanticLayerFiles((prevData) =>
                updateNodeChildren(prevData, node.fullPath || node.name, semanticLayerChildren)
              );

              uslData.tables.forEach((table) => {
                if (table.activateQuery) {
                  setPreviewableTables((prev) => {
                    const newSet = new Set(prev);
                    newSet.add(`${uslData.namespace.join('.')}.${uslData.name}.${table.name}`);
                    return newSet;
                  });
                }
              });
            } catch (error) {
              // console.error(`Error loading USL for ${node.name}:`, error.message);
              setNavErrorMsg(`Error loading USL for ${node.name} : ${error.message}`);
            }
          }
        } else {
          let childNodes = await fetchChildNodes(node, node.fullPath?.toLowerCase().includes('metastore') || node.name?.toLowerCase().includes('metastore') || false);

          if (Array.isArray(childNodes) && childNodes.some((child) => child.type === 'table')) {
            setHasTableChild(true);
          }
        }
      }
    } catch (error) {
      // setPopupMessage(`Failed to load Tree View. Please try again.`);
      setNavErrorMsg(`Failed to load Tree View. Please try again.`);
    } finally {
      stopLoading(node.uniqueId);
    }
  };

  const fetchChildNodes = async (node, isMetastore = false) => {
    const childNodes = await fetchDatasources(node.fullPath || node.name);
    if (isMetastore) {
      // setSemanticLayerFiles((prevData) => updateNodeChildren(prevData, node.name, childNodes));
      setSemanticLayerFiles((prevData) =>
        updateNodeChildren(prevData, node.fullPath || node.name, childNodes)
      );
    } else {
      setDataSources((prevData) => updateNodeChildren(prevData, node.name, childNodes));
    }

    return childNodes;
  };

  const updateNodeChildren = (nodes, identifier, newChildren) => {
    return nodes.map((node) => {

      if (node.fullPath && node.fullPath === identifier) {
        if (node.type === 'table') {
          return { ...node, children: newChildren };
        }
        const combinedChildren = [...(node.children || []), ...newChildren];
        const uniqueChildren = removeDuplicates(combinedChildren, (child) =>
          child.fullPath ? `${child.fullPath}-${child.type}` : `${child.name}-${child.type}`
        );
        return { ...node, children: uniqueChildren };
      }

      if (node.name === identifier) {
        if (node.type === 'table') {
          return { ...node, children: newChildren };
        }
        const combinedChildren = [...(node.children || []), ...newChildren];
        const uniqueChildren = removeDuplicates(combinedChildren, (child) =>
          child.fullPath ? `${child.fullPath}-${child.type}` : `${child.name}-${child.type}`
        );
        return { ...node, children: uniqueChildren };
      }

      if (node.children) {
        return {
          ...node,
          children: updateNodeChildren(node.children, identifier, newChildren)
        };
      }
      return node;
    });
  };

  const drawUSL = async (node) => {
    sessionStorage.setItem('selectedTab', 'semanticLayer');
    let fullPath = node.fullPath;
    if (fullPath.startsWith('metastore')) {
      fullPath = 'lightning.' + fullPath;
    }
    const dbname = fullPath.split('.').pop();
    const path = fullPath.split('.').slice(0, -1).join('.');

    const query = `LOAD USL ${dbname} NAMESPACE ${path}`;
    try {
      setIsLoading(true);
      const result = await fetchApi(query);
      const uslData = JSON.parse(JSON.parse(result).json);

      const subNamespacesQuery = `SHOW NAMESPACES OR TABLES IN ${fullPath}`;
      const namespacesResult = await fetchApi(subNamespacesQuery);

      if (namespacesResult) {
        const parsedNamespaces = namespacesResult.map((ns) => JSON.parse(ns));
        const subUslNamespaces = parsedNamespaces.filter((ns) => ns.type === 'usl');

        const removeDuplicates = (items, keyGenerator) => {
          const seen = new Set();
          return items.filter((item) => {
            const key = keyGenerator(item);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
        };

        const uniqueSubUslData = removeDuplicates(subUslNamespaces, (ns) => `${ns.name}-${ns.type}`)
          .map((ns) => ({
            name: ns.name,
            namespace: `${fullPath}.${ns.name}`,
          }));

        uslData.subUsl = uniqueSubUslData;
      }

      setSelectedUSL(uslData.name);
      localStorage.setItem(node.fullPath, JSON.stringify(uslData));

      setUslNamebyClick(result);
      setIsLoading(false);
      setView('semanticLayer');
      setHasTableChild(true);
    } catch (error) {
      // console.error('Error fetching USL file content:', error);
      setNavErrorMsg(`Error fetching USL file content: ${error.message}`);
      setIsLoading(false);
    }
  };

  const removeUSL = async (node) => {
    setUslToRemove(node);
    setShowConfirmPopup(true);
  };

  const handleConfirmRemove = async () => {
    if (!uslToRemove) return;

    const node = uslToRemove;
    const pathParts = node.fullPath.split('.');
    const uslName = pathParts.pop();
    const namespacePath = pathParts.join('.');

    try {
      setIsLoading(true);

      const removeUslQuery = `REMOVE USL ${uslName} NAMESPACE ${namespacePath}`;
      const uslResponse = await fetchApi(removeUslQuery);

      if (uslResponse.error) {
        setNavErrorMsg(`Error removing USL: ${uslResponse.message}`);
        return;
      }

      const dropNamespaceQuery = `DROP NAMESPACE ${node.fullPath}`;
      const namespaceResponse = await fetchApi(dropNamespaceQuery);

      if (namespaceResponse.error) {
        setNavErrorMsg(`Error dropping namespace: ${namespaceResponse.message}`);
        return;
      }

      localStorage.removeItem(uslName);

      setSemanticLayerFiles((prevData) =>
        removeNode(prevData, node.name)
      );

      setPreviewableTables((prev) => {
        const newSet = new Set(prev);
        for (const table of newSet) {
          if (table.startsWith(node.fullPath)) {
            newSet.delete(table);
          }
        }
        return newSet;
      });

    } catch (error) {
      setNavErrorMsg(`Error during USL and namespace removal: ${error.message}`);
    } finally {
      setIsLoading(false);
      setShowConfirmPopup(false);
      setUslToRemove(null);
    }
  };

  const updateTreeViewAndActivateButtons = (uslData) => {
    const { tables } = uslData;

    const semanticLayerChildren = tables.map((table) => ({
      name: table.name,
      fullPath: `${uslData.namespace.join('.')}.${uslData.name}.${table.name}`,
      type: 'table',
      children: table.columnSpecs.map((column) => ({
        name: column.name,
        fullPath: `${uslData.namespace.join('.')}.${uslData.name}.${table.name}.${column.name}`,
        type: 'column',
        isActivate: !table.activateQuery,
        dataTypeElement: (
          <span style={{ fontSize: '0.8em', color: '#888', marginLeft: '10px' }}>
            ({column.dataType.replace(/\"/g, '')})
          </span>
        ),
      })),
    }));

    setSemanticLayerFiles((prevData) =>
      updateNodeChildren(prevData, uslData.name, semanticLayerChildren)
    );

    tables.forEach((table) => {
      if (table.activateQuery) {
        setPreviewableTables((prev) => {
          const newSet = new Set(prev);
          newSet.add(`${uslData.namespace.join('.')}.${uslData.name}.${table.name}`);
          return newSet;
        });
      }
    });
  };

  const handlePreview = async (fullPath) => {
    if (!fullPath) return;
    if (fullPath.toLowerCase().includes('datasource')) {
      setView('sqlEditor');
      sessionStorage.setItem('selectedTab', 'sqlEditor');
      setPreviewTableName(fullPath);
    } else if (fullPath.toLowerCase().includes('metastore')) {
      setView('semanticLayer');
      sessionStorage.setItem('selectedTab', 'semanticLayer');
      if (fullPath.startsWith("metastore")) {
        setPreviewTableName("lightning." + fullPath);
      } else {
        setPreviewTableName(fullPath);
      }

    }
  };

  const handlePlusClick = async (event, node) => {
    event.stopPropagation();

    if (!node.children) {
      const childNodes = await fetchDatasources(node.fullPath || node.name);
      setDataSources((prev) => updateNodeChildren(prev, node.name, childNodes));
    }

    setExpandedNodeIds((prev) => [...new Set([...prev, node.uniqueId])]);

    setActiveInputNode(node.uniqueId);
    setInputValue('');
  };

  const handleMinusClick = async (event, node) => {
    if (node.name === 'lightning.datasource' || node.name === 'lightning.metastore') {
      node.fullPath = node.name;
    }

    if (node.fullPath.startsWith("metastore")) {
      node.fullPath = "lightning." + node.fullPath;
    }

    event.stopPropagation();

    const query = `DROP NAMESPACE ${node.fullPath}`;

    try {
      const response = await fetchApi(query);
      if (response.error) {
        setNavErrorMsg(`Error dropping namespace: ${response.message}`);
      } else {
        // setDataSources((prev) => removeNode(prev, node.name));
        if (node.fullPath.includes('metastore')) {
          setSemanticLayerFiles((prev) => removeNode(prev, node.name));
        } else if (node.fullPath.includes('datasource')) {
          setDataSources((prev) => removeNode(prev, node.name));
        }
      }
    } catch (error) {
      // console.error(`Error during API call: ${error.message}`);
      setNavErrorMsg(`Error during API call: ${error.message}`);
    }
  };

  const removeNode = (nodes, nodeName) => {
    return nodes
      .map((node) => {
        if (node.name === nodeName) {
          return null;
        }
        if (node.children) {
          return { ...node, children: removeNode(node.children, nodeName) };
        }
        return node;
      })
      .filter(Boolean);
  };

  const handleInputKeyDown = async (event, node) => {
    if (node.name === 'lightning.datasource' || node.name === 'lightning.metastore') {
      node.fullPath = node.name;
    }

    if (event.key === 'Escape') {
      setActiveInputNode(null);
    } else if (event.key === 'Enter') {
      const namespaceName = inputValue.trim();
      if (!namespaceName) {
        // setPopupMessage('Namespace name cannot be empty.');
        setNavErrorMsg('Namespace name cannot be empty.');
        return;
      }

      const isValidNamespace = /^[a-zA-Z0-9_]+$/.test(namespaceName);
      if (!isValidNamespace) {
        setNavErrorMsg(`Namespace name can only contain letters, numbers, and underscores.`);
        return;
      }

      // const exestingName = localStorage.getItem(semanticLayerInfo[0].name);
      // console.log(exestingName)
      // if (exestingName) {

      // }

      const query = `CREATE NAMESPACE ${node.fullPath}.${namespaceName}`;

      try {
        const response = await fetchApi(query);
        if (response.error) {
          // setPopupMessage(`Error creating namespace: ${response.message}`);
          setNavErrorMsg(`Error creating namespace: ${response.message}`);
        } else {
          setInputValue('');
          setActiveInputNode(null);
          const newChildNodes = await fetchDatasources(node.fullPath);
          setDataSources((prevData) => updateNodeChildren(prevData, node.name, newChildNodes));
          // setSemanticLayerFiles((prevData) => updateNodeChildren(prevData, node.name, newChildNodes));
          setSemanticLayerFiles((prevData) =>
            updateNodeChildren(prevData, node.fullPath || node.name, newChildNodes)
          );
          setExpandedNodeIds((prev) => [...new Set([...prev, node.uniqueId])]);
        }
      } catch (error) {
        // setPopupMessage(`Error : ${error.message}`);
        setNavErrorMsg(`Error : ${error.message}`);
      }
    }
  };

  const usedPaths = new Set();

  const renderTree = (nodes, parentPath = '', isSemanticLayer = false) => {
    // const uslDataKey = nodes[0]?.fullPath?.split('.')[1];
    const uslDataKey = nodes[0]?.fullPath?.split('.').slice(0, -1).join('.');
    const uslData = uslDataKey ? JSON.parse(localStorage.getItem(uslDataKey)) : null;

    const getUniquePath = (path) => {
      if (!usedPaths.has(path)) {
        usedPaths.add(path);
        return path;
      }
      let counter = 1;
      let newPath = `${path}_${counter}`;
      while (usedPaths.has(newPath)) {
        counter++;
        newPath = `${path}_${counter}`;
      }
      console.error(path);
      console.error(newPath);
      usedPaths.add(newPath);
      return newPath;
    };

    // if (uslData) {
    //   return renderTreeFromUSL(uslData, isSemanticLayer);
    // }

    return nodes.map((node, index) => {
      let currentPath = node.fullPath || (parentPath ? `${parentPath}.${node.name}` : node.name);

      // if (currentPath.startsWith('metastore')) {
      //   currentPath = 'lightning.' + currentPath;
      // }
      const baseId = `${currentPath}`;
      const uniqueId = getUniquePath(baseId);
      const Icon = node.type === 'table' ? TableIcon : FolderIcon;
      const hasTableChildResult = Array.isArray(node.children)
        ? node.children.some((child) => child.type === 'table')
        : false;

      setHasTableChild(hasTableChildResult);
      node.uniqueId = uniqueId;

      const savedTables = JSON.parse(localStorage.getItem('savedTables')) || [];
      if (node.type === 'table') {
        const namespace = node.fullPath.split('.').slice(0, -1).join('.');
        const namespaceData = JSON.parse(localStorage.getItem(namespace)) || null;
    
        if (namespaceData && Array.isArray(namespaceData.tables)) {
            const matchingTable = namespaceData.tables.find(table => table.name === node.name);
            node.isActivated = matchingTable && matchingTable.activateQuery ? true : false;
        } else {
            node.isActivated = false;
        }
    }

      return (
        <TreeItem
          key={uniqueId}
          itemId={uniqueId}
          label={
            <span style={{ display: 'flex', alignItems: 'center' }}>
              {node.type !== 'column' && (
                <Icon style={{ width: '18px', height: '18px', marginRight: '8px', verticalAlign: 'middle', flexShrink: 0 }} />
              )}
              {node.name}
              {node.dataTypeElement && node.dataTypeElement}

              {node.type === 'table' && (
                <button
                  className={`preview-button ${node.fullPath.toLowerCase().includes('metastore') && !(previewableTables.has(node.fullPath) || node.isActivated) ? 'hidden' : ''
                    }`}
                  onClick={(event) => {
                    event.stopPropagation();
                    handlePreview(node.fullPath);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    marginLeft: '8px',
                    verticalAlign: 'middle',
                  }}
                >
                  <PreviewIcon style={{ width: '18px', height: '18px' }} />
                </button>
              )}

              {hasTableChildResult && isSemanticLayer && node.type === 'usl' && (
                <button
                  className="btn-table-add"
                  onClick={(event) => {
                    event.stopPropagation();
                    drawUSL(node);
                  }}
                >
                  ERD
                </button>
              )}

              {hasTableChildResult && isSemanticLayer && node.type === 'usl' && (
                <button
                  className="btn-usl-del"
                  onClick={(event) => {
                    event.stopPropagation();
                    removeUSL(node);
                  }}
                >
                  DEL
                </button>
              )}

              {(node.type === 'namespace' || node.name === 'lightning.datasource' || node.name === 'lightning.metastore') && (
                <div style={{ marginLeft: '5px', display: 'flex', alignItems: 'center' }}>
                  <PlusIcon
                    onClick={(event) => handlePlusClick(event, node)}
                    style={{
                      width: '20px',
                      height: '20px',
                      cursor: 'pointer',
                      verticalAlign: 'middle',
                    }}
                  />
                  <MinusIcon
                    onClick={(event) => handleMinusClick(event, node)}
                    style={{
                      width: '20px',
                      height: '20px',
                      cursor: 'pointer',
                      verticalAlign: 'middle',
                    }}
                  />
                </div>
              )}
            </span>
          }
          onClick={() => handleTreeItemClick(node)}
        >
          {activeInputNode === node.uniqueId && (
            <div style={{ marginLeft: '30px' }}>
              <input
                autoFocus
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  handleInputKeyDown(e, node);
                }}
                style={{
                  padding: '6px',
                  border: '2px solid #27A7D2',
                  borderRadius: '6px',
                  width: '180px',
                  outline: 'none',
                }}
                placeholder="Enter Namespace"
              />

            </div>
          )}

          {Array.isArray(node.children) ? renderTree(node.children, currentPath, isSemanticLayer) : null}
        </TreeItem>
      );
    });
  };

  // const memoizedTreeData = useMemo(() => renderTree(dataSources, '', false), [dataSources]);
  const memoizedTreeData = useMemo(
    () => renderTree(dataSources, '', false),
    [dataSources, activeInputNode, inputValue]
  );

  const memoizedSemanticLayerTree = useMemo(() => renderTree(semanticLayerFiles, '', true), [semanticLayerFiles, activeInputNode, inputValue]);

  return (
    <>
      <Resizable
        axis="y"
        initial={700}
        min={200}
        max={1000}
        onResizeStart={() => {
          resizingRef.current = true;
        }}
        onResizeStop={(e, direction, ref, d) => {
          resizingRef.current = false;
        }}
      >
        {({ position, separatorProps }) => (
          <div className="guideline" style={{ display: 'flex', flexDirection: 'column', overflowY: 'hidden', height: '100%' }}>
            <div style={{ height: `${position}px`, overflowY: 'auto', padding: '0 30px', paddingTop: '20px' }}>
              {/* Data Sources Tree */}
              <div className="nav-tab bold-text">Data Sources</div>
              <SimpleTreeView className="tree-view"
                expandedItems={expandedNodeIds}
                onExpandedItemsChange={(event, newExpanded) => {
                  setExpandedNodeIds(newExpanded);
                }}
                // getItemId={(node) => `${node.fullPath}`}
                getItemId={(node) => node.uniqueId}
                // getItemId={() => uuidv4()}
              >
                {memoizedTreeData}
                {/* {renderTree(dataSources, '', false)} */}
              </SimpleTreeView>
            </div>

            <div
              {...separatorProps}
              className="separator"
              style={{
                height: '1px',
                backgroundColor: '#ccc',
                cursor: 'row-resize',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
              }}
            >
              <div
                style={{
                  width: '50px',
                  height: '8px',
                  backgroundColor: '#888',
                  borderRadius: '4px',
                  position: 'absolute',
                }}
              />
            </div>

            <div style={{ flexGrow: 1, overflowY: 'auto', paddingRight: '30px', paddingLeft: '30px', paddingBottom: '50px', height: `calc(100% - ${position}px + 30px)`, }}>
              {/* Semantic Layer Tree */}
              <div className="nav-tab bold-text" style={{ display: 'flex', alignItems: 'center' }}>
                Semantic Layer
                {/* <CirclePlus
                  onClick={() => setShowPopup(true)}
                  style={{ height: '20px', width: '20px', fill: '#27A7D2', cursor: 'pointer', marginLeft: '10px' }}
                /> */}
                {selectedTreeItem !== null && selectedTreeItem?.fullPath && selectedTreeItem.fullPath.split('.').length > 2 && selectedTreeItem.type !== 'table' && selectedTreeItem.fullPath.toLowerCase().includes('metastore') && (
                  <CirclePlus
                    onClick={() => setShowPopup(true)}
                    style={{ height: '20px', width: '20px', fill: '#27A7D2', cursor: 'pointer', marginLeft: '10px' }}
                  />
                )}
              </div>
              <SimpleTreeView className="tree-view"
                expandedItems={expandedNodeIds}
                onExpandedItemsChange={(event, newExpanded) => {
                  setExpandedNodeIds(newExpanded);
                }}
                // getItemId={(node) => `${node.fullPath}`}
                getItemId={(node) => node.uniqueId}
                // getItemId={() => uuidv4()}
              >
                {memoizedSemanticLayerTree}
              </SimpleTreeView>
              <SetSemanticLayerModal
                showPopup={showPopup}
                setShowPopup={setShowPopup}
                ddlName={ddlName}
                setDdlName={setDdlName}
                ddlCode={ddlCode}
                setDdlCode={setDdlCode}
                handleGenerateClick={handleGenerateClick}
              />
            </div>
            {popupMessage && (
              <div className="popup-overlay" onClick={closePopup}>
                <div className="popup-message" onClick={(e) => e.stopPropagation()}>
                  <p>{popupMessage}</p>
                  <div className="popup-buttons">
                    <button className="btn-primary" onClick={closePopup}>Close</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </Resizable>

      {/* Remove USL Confirm Popup */}
      {showConfirmPopup && (
        <div className="popup-overlay">
          <div className="popup-message">
            <p>{`Are you sure you want to remove '${uslToRemove?.name}'?`}</p>
            <div className="popup-buttons">
              <button
                className="btn-secondary"
                onClick={() => setShowConfirmPopup(false)}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleConfirmRemove}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

    </>
  );
};

export default Navigation;