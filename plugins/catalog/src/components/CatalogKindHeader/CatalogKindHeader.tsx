/*
 * Copyright 2021 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React, { useEffect, useState, useMemo } from 'react';
import {
  createStyles,
  InputBase,
  makeStyles,
  MenuItem,
  Select,
  Theme,
} from '@material-ui/core';
import {
  EntityKindFilter,
  filterKinds,
  useAllKinds,
  useEntityList,
} from '@backstage/plugin-catalog-react';

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    root: {
      ...theme.typography.h4,
    },
  }),
);

/**
 * Props for {@link CatalogKindHeader}.
 *
 * @public
 */
export interface CatalogKindHeaderProps {
  /**
   * Entity kinds to show in the dropdown; by default all kinds are fetched from the catalog and
   * displayed.
   */
  allowedKinds?: string[];
  /**
   * The initial kind to select; defaults to 'component'. A kind filter entered directly in the
   * query parameter will override this value.
   */
  initialFilter?: string;
}

/** @public */
export function CatalogKindHeader(props: CatalogKindHeaderProps) {
  const { initialFilter = 'component', allowedKinds } = props;
  const classes = useStyles();
  const { allKinds } = useAllKinds();
  const {
    filters,
    updateFilters,
    queryParameters: { kind: kindParameter },
  } = useEntityList();

  const queryParamKind = useMemo(
    () => [kindParameter].flat()[0],
    [kindParameter],
  );

  const [selectedKind, setSelectedKind] = useState(
    queryParamKind ?? filters.kind?.value ?? initialFilter,
  );

  // Set selected kind from filters; this happens when the kind filter is
  // updated from another component
  useEffect(() => {
    if (filters.kind?.value) {
      setSelectedKind(filters.kind?.value);
    }
  }, [filters.kind]);

  useEffect(() => {
    updateFilters({
      kind: selectedKind ? new EntityKindFilter(selectedKind) : undefined,
    });
  }, [selectedKind, updateFilters]);

  const options = filterKinds(allKinds, allowedKinds, selectedKind);

  return (
    <Select
      input={<InputBase />}
      value={selectedKind.toLocaleLowerCase('en-US')}
      onChange={e => setSelectedKind(e.target.value as string)}
      classes={classes}
    >
      {Object.keys(options).map(kind => (
        <MenuItem value={kind} key={kind}>
          {`${options[kind]}s`}
        </MenuItem>
      ))}
    </Select>
  );
}
