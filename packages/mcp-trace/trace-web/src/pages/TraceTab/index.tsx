import * as React from "react";
(window as any).React = React;
import { SpanEntity } from "@mcp-trace/trace-core";
import "./Trace.css";
import { FiX } from "react-icons/fi";
import { traceListAtom, showTraceAtom } from "../../core/tracing";
import { useAtom } from "jotai";
import { useEffect, useRef, useState } from "react";
import { Box, SimpleGrid, Text, VStack } from "@chakra-ui/react";
import TraceTree from "./TraceTree";
import SpanDetail from "./SpanDetail";
import { Modal, ModalBody, ModalContent, ModalHeader } from "@heroui/react";
import JsonView from "./JsonView";

export default function TraceTab() {
  const [, setShowTrace] = useAtom(showTraceAtom);
  const init = useRef(false);
  const [loading, setLoading] = useState(true);
  const [showSpan, setShowSpan] = useState(false);
  const [selectNode, setSelectNode] = useState<SpanEntity>();
  const [showModal, setShowModal] = useState(false);
  const [showInput, setShowInput] = useState(true);
  const [treeData, setTreeData] = useState([] as any[]);
  const [requestDurations, setRequestDurations] = useState<
    Record<string, number>
  >({});
  const [traceData] = useAtom(traceListAtom);

  useEffect(() => {
    if (init.current) {
      return;
    }
    init.current = true;
    setLoading(false);
    setTreeData(buildTree(traceData));
    const durations = calculateDurations(traceData);
    setRequestDurations(durations);
    init.current = false;
  }, [traceData]);

  const buildTree = (list: SpanEntity[]) => {
    const treeMap = new Map<string, SpanEntity[]>();
    list.forEach((entity) => {
      if (entity.parentId) {
        const children = treeMap.get(entity.parentId);
        if (children) {
          children.push(entity);
        } else {
          treeMap.set(entity.parentId, [entity]);
        }
      }
    });
    return list
      .map((e) => {
        const children = treeMap
          .get(e.id)
          ?.sort((a, b) => a.startTime - b.startTime);
        e.children = children;
        return e;
      })
      .filter((e) => e.name === "user");
  };

  const handlerShowModal = (input: boolean) => {
    setShowModal(true);
    setShowInput(input);
  };

  const calculateDurations = (items: SpanEntity[]) => {
    const totals: Record<string, number> = {};

    items.forEach((span) => {
      const endTime = span.endTime || Date.now();
      const duration = endTime - span.startTime;
      if (!totals[span.traceId]) {
        totals[span.traceId] = 0;
      }
      totals[span.traceId] += parseFloat(duration.toFixed(2));
    });
    return totals;
  };

  const handleNodeClick = (node: SpanEntity) => {
    setSelectNode(node);
    setShowSpan(true);
  };

  return (
    <>
      <div className=".tab-container_trace">
        <div className="tab-header">
          <button key="TraceTab" className={`tab-button active`}>
            本地Trace
          </button>
          <button
            onClick={() => setShowTrace(false)}
            className={`closeButton p-2`}
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>
        <div className={`tab-content right`}>
          <div key="TraceTab" className={`tab-pane active`}>
            <SimpleGrid columns={2} templateColumns="2fr 1fr">
              <Box
                p={10}
                border="1px"
                borderStyle="solid"
                className="scroll-container"
              >
                <VStack spacing={4} align="start">
                  {loading ? (
                    <Text>Loading...</Text>
                  ) : (
                    treeData.map((node: SpanEntity) => (
                      <TraceTree
                        key={node.id}
                        treeData={treeData}
                        node={node}
                        requestDurations={requestDurations}
                        onClick={handleNodeClick}
                      />
                    ))
                  )}
                </VStack>
              </Box>
              {showSpan && selectNode && (
                <Box
                  p={10}
                  border="1px"
                  borderStyle="solid"
                  className="scroll-container"
                >
                  <SpanDetail
                    node={selectNode}
                    clickShowModal={handlerShowModal}
                  />
                </Box>
              )}
            </SimpleGrid>
          </div>
        </div>
      </div>
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        classNames={{
          base: `settingsModal h-[70vh] max-h-[70vh]`,
          body: "p-0 h-[calc(100vh-10rem)] overflow-hidden",
          backdrop: "bg-black/50 backdrop-blur-sm",
        }}
      >
        <ModalContent>
          <ModalHeader className="border-b border-divider">
            <div className="flex justify-center items-center gap-2 w-full">
              <span className="text-xl">Content</span>
            </div>
          </ModalHeader>
          <ModalBody style={{ overflow: "auto" }}>
            {selectNode && (
              <JsonView
                data={
                  showInput
                    ? selectNode.attributes?.inputs
                    : selectNode.attributes?.outputs || "no content"
                }
              />
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
}
