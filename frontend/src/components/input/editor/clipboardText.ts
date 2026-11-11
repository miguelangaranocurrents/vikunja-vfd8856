import type {Fragment, Node as PMNode, Slice} from '@tiptap/pm/model'

// Plain-text representation of copied editor content. ProseMirror's default
// joins every textblock with blank lines, which throws away list structure;
// this keeps list markers so pasting into a plain-text field stays readable.

const LIST_TYPES = ['bulletList', 'orderedList', 'taskList']
const LIST_ITEM_TYPES = ['listItem', 'taskItem']

function leafText(node: PMNode): string {
	if (node.type.name === 'hardBreak') {
		return '\n'
	}
	const leaf = node.type.spec.leafText
	if (leaf) {
		return leaf(node)
	}
	return node.textContent
}

function inlineText(fragment: Fragment): string {
	return fragment.textBetween(0, fragment.size, '\n', leafText)
}

function indentLines(text: string, indent: string): string {
	return text.split('\n').map(line => line === '' ? line : indent + line).join('\n')
}

function serializeListItem(item: PMNode, marker: string): string {
	const parts: string[] = []
	item.forEach(child => {
		if (LIST_TYPES.includes(child.type.name)) {
			parts.push(indentLines(serializeList(child), '  '))
		} else if (parts.length === 0) {
			parts.push(marker + serializeNode(child))
		} else {
			parts.push(indentLines(serializeNode(child), ' '.repeat(marker.length)))
		}
	})
	if (parts.length === 0) {
		return marker.trimEnd()
	}
	return parts.join('\n')
}

function itemMarker(item: PMNode, ordered: boolean, index: number): string {
	if (item.type.name === 'taskItem') {
		return `- [${item.attrs.checked ? 'x' : ' '}] `
	}
	return ordered ? `${index}. ` : '- '
}

function serializeList(list: PMNode): string {
	const ordered = list.type.name === 'orderedList'
	let index = ordered ? Number(list.attrs.start ?? 1) : 1
	const lines: string[] = []
	list.forEach(item => {
		lines.push(serializeListItem(item, itemMarker(item, ordered, index)))
		index++
	})
	return lines.join('\n')
}

function serializeNode(node: PMNode): string {
	if (node.isTextblock) {
		return inlineText(node.content)
	}
	if (LIST_TYPES.includes(node.type.name)) {
		return serializeList(node)
	}
	if (LIST_ITEM_TYPES.includes(node.type.name)) {
		return serializeListItem(node, itemMarker(node, false, 1))
	}
	if (node.isLeaf) {
		return leafText(node)
	}
	return serializeFragment(node.content)
}

export function serializeFragment(fragment: Fragment): string {
	if (fragment.childCount === 0) {
		return ''
	}
	if (fragment.firstChild?.isInline) {
		return inlineText(fragment)
	}

	const blocks: string[] = []
	let pendingItems: string[] = []
	const flushItems = () => {
		if (pendingItems.length > 0) {
			blocks.push(pendingItems.join('\n'))
			pendingItems = []
		}
	}

	fragment.forEach(child => {
		// A partial selection can open into a list, leaving bare list items at the top.
		if (LIST_ITEM_TYPES.includes(child.type.name)) {
			pendingItems.push(serializeNode(child))
			return
		}
		flushItems()
		blocks.push(serializeNode(child))
	})
	flushItems()

	return blocks.join('\n\n')
}

export function clipboardTextSerializer(slice: Slice): string {
	return serializeFragment(slice.content)
}
